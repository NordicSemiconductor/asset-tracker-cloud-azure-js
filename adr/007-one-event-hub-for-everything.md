# ADR 007: One Event Hub for all device messages

Ideally we want to invoke functions that handle A-GPS and P-GPS requests from
devices only for these specific messages.

Azure IoT Hub supports [filters for routing messages][1], however [property
bags][2] are not supported in these filters. Therefore filtering of A-GPS and
P-GPS messages has to be done in the Azure function, with the downside of it
being called for all device messages.

The incoming messages can be filtered based on the content, however for this to
work devices would need to set the content-type and encoding of the message they
are sending by adding [additional properties to the MQTT topic name][3], like
this:
`devices/f603100e-750f-46aa-b4c5-fb046196af9a/messages/events/$.ct=application%2Fjson&$.ce=utf-8`.

This adds extra overhead to the message size. Since devices will not switch
between different content-types and encodings, a default value for device
message content-type and encoding should be configurable on the IoT hub itself.
However this is not possible today.

Content-based filtering requires the use of an additional Event Hub, because the
built-in Event Hubs are already used for all generic incoming Twin and device
messages. However, pricing for Event Hubs start at USD 10 per month. For a small
deployment the costs for invoking a filter Azure Function is expected to be
lower than that.

[1]:
  https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-routing-query-syntax?WT.mc_id=Portal-Microsoft_Azure_Support#message-routing-query-based-on-message-properties
[2]:
  https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-mqtt-support#receiving-cloud-to-device-messages
[3]:
  https://azure.microsoft.com/es-es/blog/iot-hub-message-routing-now-with-routing-on-message-body/
