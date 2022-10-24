Feature: nRF Cloud Neighbor Cell Geolocation

    Optionally, device locations can be resolved by the nRF Cloud API using the neighboring cell measurement reports
    Note: nRF Cloud's geolocation API does not distinguish between different network modes.

    Contexts:

    | nw    | apiNw |
    | ltem  | lte   |

    Background:

        This enques a mock response on the mock HTTP API the stack is configure
        to use for the nRF Cloud integration

        Given I am run after the "Store neighboring cell measurement reports" feature
        And the endpoint is "{apiEndpoint}"
        And the Authorization header is "Bearer {accessToken}"
        And the Content-Type header is "application/json; charset=utf-8"
        And I store a random number between 0 and 20000 into "accuracy"
        And I store a random float between -90 and 90 into "lat"
        And I store a random float between -180 and 180 into "lng"
        And I enqueue this mock HTTP API response with status code 200 for a POST request to api.nrfcloud.com/v1/location/cell
            """
            {
                "uncertainty": {accuracy},
                "lat": {lat},
                "lon": {lng},
                "fulfilledWith": "MCELL"
            }
            """
            
   Scenario: Get the latest report

        Given the endpoint is "{apiEndpoint}"
        And the Authorization header is "Bearer {accessToken}"
        And the Content-Type header is "application/json; charset=utf-8"
        When I POST /neighborcellgeolocation/reports?deviceId={trackerId}
        Then the response status code should be 200
        And the response Content-Type should be "application/json; charset=utf-8"
        Then the response should match this JSON
        """
        {
            "items": [
                {
                    "report": {
                        "mcc": 242,
                        "mnc": 1,
                        "cell": {ncellmeasCellId},
                        "area": {ncellmeasAreaId},
                        "earfcn": 6446,
                        "adv": 80,
                        "rsrp": -97,
                        "rsrq": -9,
                        "nmr": [
                            {
                                "earfcn": 262143,
                                "cell": 501,
                                "rsrp": -104,
                                "rsrq": -18
                            },
                            {
                                "earfcn": 262265,
                                "cell": 503,
                                "rsrp": -116,
                                "rsrq": -11
                            }
                        ],
                        "ts": {ts}
                    },
                    "nw": "LTE-M",
                    "deviceId": "{trackerId}"
                }
            ]
        }
        """
        And I store "items[0].id" of the response body as "<nw>-ncellmeasReportId"
    
    Scenario: Retrieve the location for the report

        Given I store "$millis()" into "ts"
        When I GET /neighborcellgeolocation/{<nw>-ncellmeasReportId}/nrfcloud?ts={ts}
        Then the response status code should be 200
        And the response Access-Control-Allow-Origin should be "*"
        And the response Content-Type should be "application/json; charset=utf-8"
        And the response should match this JSON
            """
            {
                "accuracy": {accuracy},
                "lat": {lat},
                "lng": {lng}
            }
            """

    Scenario: The nRF Cloud API should have been called

        Then the mock HTTP API should have been called with a POST request to api.nrfcloud.com/v1/location/cell
            """
            content-type: application/json
            
            {
                "<apiNw>": [
                    {
                        "mcc": 242,
                        "mnc": 1,
                        "eci": {ncellmeasCellId},
                        "tac": {ncellmeasAreaId},
                        "earfcn": 6446,
                        "adv": 80,
                        "rsrp": -97,
                        "rsrq": -9,
                        "nmr": [
                            {
                            "earfcn": 262143,
                            "pci": 501,
                            "rsrp": -104,
                            "rsrq": -18
                            },
                            {
                            "earfcn": 262265,
                            "pci": 503,
                            "rsrp": -116,
                            "rsrq": -11
                            }
                        ]
                    }
                ]
            }
            """