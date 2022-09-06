Feature: Device: Messages

  Devices can publish arbitrary messages on a special topic

  Background:

    Given I am run after the "Device: Update Shadow" feature
    And I am run after the "Login" feature
    And I store a random number between 1 and 300 into "magnitude"

  Scenario: Devices publishes that a button was pressed

    Given I store "$millis()" into "ts"
    Then the tracker "{trackerId}" publishes this message to the topic devices/{trackerId}/messages/events/%24.ct=application%2Fjson&%24.ce=utf-8
      """
      {
      "btn": {
      "v": 1,
      "ts": {ts}
      }
      }
      """
    Given I store "$millis()" into "ts"
    Then the tracker "{trackerId}" publishes this message to the topic devices/{trackerId}/messages/events/%24.ct=application%2Fjson&%24.ce=utf-8
      """
      {
      "btn": {
      "v": 0,
      "ts": {ts}
      }
      }
      """

  Scenario: Query the button presses

    Given the endpoint is "{apiEndpoint}"
    And the Authorization header is "Bearer {accessToken}"
    And the Content-Type header is "application/json; charset=utf-8"
    When I POST to /history with this JSON
      """
      {
        "query": "SELECT c.deviceUpdate.btn.v AS v FROM c WHERE c.deviceId = \"{trackerId}\" AND c.deviceUpdate.btn.v != null ORDER BY c.timestamp DESC"
      }
      """
    Then the response status code should be 200
    And "result" of the response body should match this JSON
      """
      [
        {
          "v": 1
        },
        {
          "v": 0
        }
      ]
      """

  Scenario: Devices publishes that an impact was detected

    Given I store "$millis()" into "ts"
    Then the tracker "{trackerId}" publishes this message to the topic devices/{trackerId}/messages/events/%24.ct=application%2Fjson&%24.ce=utf-8
      """
      {
      "impact": {
      "v": {magnitude},
      "ts": {ts}
      }
      }
      """
      
  Scenario: Query the impacts

    Given the endpoint is "{apiEndpoint}"
    And the Authorization header is "Bearer {accessToken}"
    And the Content-Type header is "application/json; charset=utf-8"
    When I POST to /history with this JSON
      """
      {
        "query": "SELECT c.deviceUpdate.impact.v AS v, c.deviceUpdate.impact.ts as ts FROM c WHERE c.deviceId = \"{trackerId}\" AND c.deviceUpdate.impact.v != null ORDER BY c.timestamp DESC"
      }
      """
    Then the response status code should be 200
    And "result" of the response body should match this JSON
      """
      [
        {
          "v": {magnitude},
          "ts": {ts}
        }
      ]
      """
