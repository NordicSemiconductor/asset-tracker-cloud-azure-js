@Only
Feature: Store neighboring cell measurement reports

    Neighboring cell measurement reports are too big to be stored in the AWS
    shadow, so they are stored in CosmosDB.

    Background:

        Given I am run after the "Connect a tracker" feature
        And I am run after the "Device: Update Shadow" feature
        And I am run after the "Login" feature
        And I store a random number between 1 and 100000000 into "ncellmeasCellId"
        And I store a random number between 1 and 100000000 into "ncellmeasAreaId"
    
    Scenario: Device connects

        Given I store "$millis()" into "ts"
        Then the tracker "{trackerId}" updates its reported state with
            """
            {
                "dev": {
                    "v": {
                        "nw": "LTE-M GPS"
                    },
                    "ts": {ts}
                },
                "roam": {
                    "v": {
                        "rsrp": -97,
                        "area": {ncellmeasAreaId},
                        "mccmnc": 24201,
                        "cell": {ncellmeasCellId},
                        "ip": "10.202.80.9"
                    },
                    "ts": {ts}
                }
            }
            """

    Scenario: Device publishes %NCELLMEAS report

        Given I store "$millis()" into "ts"
        Then the tracker "{trackerId}" publishes this message to the topic devices/{trackerId}/messages/events/ncellmeas&%24.ct=application%2Fjson&%24.ce=utf-8
        """
        {
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
        }
        """

    Scenario: Find the latest report

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
                    "nw": "LTE-M GPS",
                    "deviceId": "{trackerId}"
                }
            ]
        }
        """