Feature: P-GPS Data Fan Out (The cargo container scenario)

  In this scenario hundreds, or thousands of devices are unloaded from a steel
  walled cargo container (intermodal container). All of them connect to the 
  cellular network, and the same cell tower, and request P-GPS data, because
  they have been offline for weeks while being shipped over the ocean.
  
  While all devices should receive P-GPS data as per their request, we do not
  want to hammer to third-party API with thousands of requests for the same
  P-GPS data.

  Contexts:

    | device                   |
    | cargo container device 1 |
    | cargo container device 2 |

  Scenario: Register and connect device

    Given I am run after the "P-GPS" feature
    And I have a random UUID in "pgpsDevice"
    And I generate a certificate for the device "{pgpsDevice}"
    And I connect the device "{pgpsDevice}"

  Scenario: Request P-GPS data

    When the device "{pgpsDevice}" publishes this message to the topic devices/{pgpsDevice}/messages/events/pgps=get&%24.ct=application%2Fjson&%24.ce=utf-8
      """
      {
        "n": {predictionCount},
        "time": {startGpsTimeOfDaySeconds}
      }
      """
    Then the device "{pgpsDevice}" receives a messages on the topic devices/{pgpsDevice}/messages/devicebound/%24.to=%2Fdevices%2F{pgpsDevice}%2Fmessages%2Fdevicebound&pgps=result into "pgpsData"
    And "pgpsData" should match this JSON
      """
      {
        "path": "public/15131-0_15135-72000.bin",
        "host": "pgps.nrfcloud.com"
      }
      """
    
    Scenario: Delete device
  
    Given the endpoint is "{apiEndpoint}"
    And the Authorization header is "Bearer {accessToken}"
    And the Content-Type header is "application/json; charset=utf-8"
    When I DELETE /device/{pgpsDevice}
    Then the response status code should be 202