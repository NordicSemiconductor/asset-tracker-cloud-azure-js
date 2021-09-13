@Only
Feature: Connect a tracker
  As a user
  I can connect a tracker

  Scenario: Generate a certificate
    Given I have a random UUID in "trackerId"
    When I generate a certificate for the device "{trackerId}"
    Then I connect the device "{trackerId}"