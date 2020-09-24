var keycloakAuth;

(function () {
    'use strict';

    var accessToken;

    // This config stores the important strings needed to
    // connect to the keycloak API and OAuth service to
    // gain authorization that we then exchange for an access
    // token.
    //
    // Do not store your client secret here.
    // We are using a server-side OAuth flow, and the client
    // secret is kept on the web server.

    // using keycloak library

    function loginToKeyCloak() {

        const keycloakConfig = {
            'url': 'http://localhost:8180/auth',
            'realm': 'divyansh',
            'clientId': 'demo_client1'
        };

        keycloakAuth = new Keycloak(keycloakConfig);
        console.log(keycloakAuth)
        keycloakAuth.init({ onLoad: 'login-required', checkLoginIframe: false })
            .success((res) => {
                //accessToken = keycloakAuth.token;
                tableau.password = keycloakAuth.token;
                console.log(res);
                var hasAuth = keycloakAuth.token.length > 0;
                //var hasAuth = accessToken && accessToken.length > 0; // see if the user has already logged in and is already authenticated with the OAuth provider
                updateUIWithAuthState(hasAuth);
            })
            .error((err) => {
                console.log(err)
            });
    }

    // This function parses the access token in the URI if available
    // It also adds a link to the foursquare connect button
    $(document).ready(function () {

        loginToKeyCloak();

        $("#connectbutton").click(function () {
            loginToKeyCloak();
        });

        $("#getvenuesbutton").click(function () {
            tableau.connectionName = "Foursquare Venues Data";
            console.log("getvenues");
            tableau.submit();
            console.log("tableau submit called");
        });
    });
    

    //------------- OAuth Helpers -------------//
    // This helper function returns the URI for the sample app endpoint
    // It appends the passed in accessToken to the call to personalize the call for the user
    function getSampleAppURI(accessToken) {
        return "http://localhost:8080/mrx-like-app/csv2?access_token=" + accessToken;
    }

    // This function toggles the label shown depending
    // on whether or not the user has been authenticated
    function updateUIWithAuthState(hasAuth) {
        if (hasAuth) {
            $(".notsignedin").css('display', 'none');
            $(".signedin").css('display', 'block');
        } else {
            $(".notsignedin").css('display', 'block');
            $(".signedin").css('display', 'none');
        }
    }

    //------------- Tableau WDC code -------------//
    // Create tableau connector, should be called first
    var myConnector = tableau.makeConnector();

    // add this after tableau.makeConnector() function.
    // Init function for connector, called during every phase but
    // only called when running inside the simulator or tableau
    myConnector.init = function (initCallback) {
        tableau.authType = tableau.authTypeEnum.custom;

        // If we are in the auth phase we only want to show the UI needed for auth
        if (tableau.phase == tableau.phaseEnum.authPhase) {
            $("#getvenuesbutton").css('display', 'none');
        }


        if (tableau.phase == tableau.phaseEnum.gatherDataPhase) {
            // If the API that WDC is using has an endpoint that checks
            // the validity of an access token, that could be used here.
            // Then the WDC can call tableau.abortForAuth if that access token
            // is invalid.
            //tableau.abortForAuth("access token invalid, please login again");
        }

        initCallback();

        // If we are not in the data gathering phase, we want to store the token
        // This allows us to access the token in the data gathering phase

        if (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase) {
            if (tableau.password.length > 0) {

                if (tableau.phase == tableau.phaseEnum.authPhase) {
                    // Auto-submit here if we are in the auth phase
                    tableau.submit()
                }

                return;
            }
        }


    };

    // Declare the data to Tableau that we are returning from Foursquare
    myConnector.getSchema = function (schemaCallback) {
        var schema = [];

        var col1 = { id: "id", dataType: "string" };
        var col2 = { id: "mag", dataType: "float" };
        var col3 = { id: "title", dataType: "string" };
        var col4 = { id: "location", dataType: "geometry" };
        var cols = [col1, col2, col3, col4];

        var tableInfo = {
            id: "earthquakeFeed",
            columns: cols
        }

        schema.push(tableInfo);

        schemaCallback(schema);
    };

    // This function actually make the API call and
    // parses the results and passes them back to Tableau
    myConnector.getData = function async(table, doneCallback) {
        var dataToReturn = [];
        var hasMoreData = false;

        //var accessToken = tableau.password;
        keycloakAuth.updateToken(20).success(res => {
            
            //tableau.password = ""; // this ensures that each time the user is asked to log in
            var connectionUri = getSampleAppURI(keycloakAuth.token);

            var xhr = $.ajax({
                url: connectionUri,
                dataType: 'json',
                success: function (data) {
                    console.log(data);
                    var dataToReturn = [];
                    if (data.features) {
                        var venues = data.features;

                        var ii;
                        for (ii = 0; ii < venues.length; ++ii) {
                            var venue = {
                                'id': venues[ii].id,
                                'mag': venues[ii].properties.mag,
                                'title': venues[ii].properties.title,
                                'location': venues[ii].geometry
                            };
                            dataToReturn.push(venue);
                        }

                        table.appendRows(dataToReturn);
                        doneCallback();
                    }
                    else {
                        tableau.abortWithError("No results found");
                    }
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    // WDC should do more granular error checking here
                    // or on the server side.  This is just a sample of new API.
                    tableau.abortForAuth("Invalid Access Token");
                }
            });
        }).error(err => {
            console.log(err);
        })
    };

    // Register the tableau connector, call this last
    tableau.registerConnector(myConnector);


})();  // end of anonymous function
