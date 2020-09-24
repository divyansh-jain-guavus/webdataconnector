//const Keycloak = require("keycloak-js");
//const { KeycloakService } = require("./keycloakUtils");

//import KeycloakService from './keycloakUtils';

var keycloakAuth;
var accessToken;


(function () {
    'use strict';

    // This config stores the important strings needed to
    // connect to the keycloak API and OAuth service to
    // gain authorization that we then exchange for an access
    // token.
    //
    // Do not store your client secret here.
    // We are using a server-side OAuth flow, and the client
    // secret is kept on the web server.
    var config = {
        clientId: 'demo_app',
        redirectUri: 'http://localhost:3333/redirect', // url where web data connector is running
        redirectUri1: 'http://localhost:3333/index.html',
        authUrl: 'http://localhost:8180/auth',
        realm: 'divyansh'
    };

    // using keycloak library

    // This function parses the access token in the URI if available
    // It also adds a link to the foursquare connect button
    $(document).ready(function () {

        const config = {
            'url': 'http://localhost:8180/auth',
            'realm': 'divyansh',
            'clientId': 'demo_client1'
        };
        keycloakAuth = new Keycloak(config);
        console.log(keycloakAuth)
        keycloakAuth.init({ onLoad: 'login-required', checkLoginIframe: false })
            .success((res) => {
                accessToken = keycloakAuth.token;
                console.log(res);
                
                //var hasAuth = accessToken && accessToken.length > 0; // see if the user has already logged in and is already authenticated with the OAuth provider
                updateUIWithAuthState(hasAuth);
            })
            .error((err) => {
                console.log('hello')
                console.log(err)

            });

        $("#connectbutton").click(function () {
            doAuthRedirect();
        });

        $("#getvenuesbutton").click(function () {
            tableau.connectionName = "Foursquare Venues Data";
            console.log("getvenues");
            tableau.submit();
            console.log("tableau submit called");
        });
    });

    // An on-click function for the connect to foursquare button,
    // This will redirect the user to a foursquare login
    function doAuthRedirect() {
        var appId = config.clientId;
        if (tableau.authPurpose === tableau.authPurposeEnum.ephemeral) {
            appId = config.clientId;  // This should be Desktop
        } else if (tableau.authPurpose === tableau.authPurposeEnum.enduring) {
            appId = config.clientId; // This should be the Tableau Server appID
        }

        var url = config.authUrl + '/realms/' + config.realm + "/protocol/openid-connect/auth?response_type=code&client_id=" + appId +
            '&scope=openid' + '&redirect_uri=' + config.redirectUri1;
        window.location.href = url; // open the new url in the same window, we are updating the current window url here
    }

    //------------- OAuth Helpers -------------//
    // This helper function returns the URI for the venueLikes endpoint
    // It appends the passed in accessToken to the call to personalize the call for the user
    function getVenueLikesURI(accessToken) {
        return "http://localhost:8080/mrx-like-app/csv1?access_token=" + accessToken;
        //return "http://localhost:8080/mrx-like-app/csv1";
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

        var accessToken = Cookies.get("accessToken");
        console.log("Access token is '" + accessToken + "'");
        var hasAuth = (accessToken && accessToken.length > 0) || tableau.password.length > 0; // || -> &&, this ensures that each time the user is asked to log in
        updateUIWithAuthState(hasAuth);

        initCallback();

        // If we are not in the data gathering phase, we want to store the token
        // This allows us to access the token in the data gathering phase

        if (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase) {
            if (hasAuth) {
                tableau.password = "";
                tableau.password = accessToken;

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
            var connectionUri = getVenueLikesURI(keycloakAuth.token);

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
