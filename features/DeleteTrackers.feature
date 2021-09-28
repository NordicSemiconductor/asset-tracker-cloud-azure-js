@Last
@Only
Feature: Delete trackers
  As a user
  I can delete trackers

  Background:

    Given I am run after the "Login" feature
    And I am run after the "Connect a tracker" feature
    And the endpoint is "{apiEndpoint}"
    And the Authorization header is "Bearer {accessToken}"
    And the Content-Type header is "application/json; charset=utf-8"

  Scenario: Delete the cat

    When I DELETE /device/{trackerId}
    Then the response status code should be 202
