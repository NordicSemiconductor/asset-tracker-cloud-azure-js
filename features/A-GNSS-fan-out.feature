Feature: A-GNSS Data Fan Out (The cargo container scenario)

  In this scenario hundreds, or thousands of devices are unloaded from a steel
  walled cargo container (intermodal container). All of them connect to the 
  cellular network, and the same cell tower, and request A-GNSS data, because
  they have been offline for weeks while being shipped over the ocean.
  
  While all devices should receive A-GNSS data as per their request, we do not
  want to hammer to third-party API with thousands of requests for the same
  A-GNSS data.

  Contexts:

    | device                   |
    | cargo container device 1 |
    | cargo container device 2 |

  Scenario: Register and connect device

    Given I am run after the "A-GNSS" feature
    And I have a random UUID in "agnssDevice"
    And I generate a certificate for the device "{agnssDevice}"
    And I connect the device "{agnssDevice}"

  Scenario: Request A-GNSS data

    When the device "{agnssDevice}" publishes this message to the topic devices/{agnssDevice}/messages/events/agnss=get&%24.ct=application%2Fjson&%24.ce=utf-8
      """
      {
        "mcc": {agnssMcc},
        "mnc": {agnssMnc},
        "cell": {agnssCellId},
        "area": {agnssArea},
        "types": [
          1,
          2,
          3,
          4,
          6,
          7,
          8,
          9
        ]
      }
      """
    Then the device "{agnssDevice}" receives 2 raw messages on the topic devices/{agnssDevice}/messages/devicebound/agnss=result into "agnssData"
    And  "$length($filter(agnssData, function($v) { $contains($v, '01010100f9fffffffeffffff0f7b12890612031f00017') })) > 0" should be true
    And  "$length($filter(agnssData, function($v) { $contains($v, '01021e0001006400c675009cff859f13000b0000c6753') })) > 0" should be true
    
  Scenario: Delete device
  
    Given the endpoint is "{apiEndpoint}"
    And the Authorization header is "Bearer {accessToken}"
    And the Content-Type header is "application/json; charset=utf-8"
    When I DELETE /device/{agnssDevice}
    Then the response status code should be 202