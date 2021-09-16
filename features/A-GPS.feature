@Skip
Feature: A-GPS

  Devices can request A-GPS data to decrease their time-to-fix when using GPS

  Background:

    Prepare the mock API responses. The A-GPS data request will be split into
    two requests, one for type 2 (ephemerides) and one for the rest.

    Given I am run after the "Connect a tracker" feature
    And I store a random number between 100 and 999 into "agpsMcc"
    And I store a random number between 0 and 99 into "agpsMnc"
    And I store a random number between 1 and 100000000 into "agpsCellId"
    And I store a random number between 100 and 199 into "agpsArea"
    And I enqueue this mock HTTP API response with status code 200 for a HEAD request to api.nrfcloud.com/v1/location/agps?customTypes=1%2C3%2C4%2C6%2C7%2C8%2C9&eci={agpsCellId}&mcc={agpsMcc}&mnc={agpsMnc}&requestType=custom&tac={agpsArea}
      """
      Content-Type: application/octet-stream
      Content-Length: 1160
      
      """
    And I enqueue this mock HTTP API response with status code 200 for a GET request to api.nrfcloud.com/v1/location/agps?customTypes=1%2C3%2C4%2C6%2C7%2C8%2C9&eci={agpsCellId}&mcc={agpsMcc}&mnc={agpsMnc}&requestType=custom&tac={agpsArea}
      """
      Content-Type: application/octet-stream

      01010100f9fffffffeffffff0f7b12890612031f00017b0f00af5ab01b5ffd001a0da1002bcf36004b0a24009c5d89ff7202fdff027b0f009fa5bb0d4cfd00860da10071533300c3e4c2ffd3e294ff6ffdffff037b0f003f1f331256fd00ec0da1004e11610093b3260008ca5d00f4fefcff047b0f00ec0a0b0c4efd00340da10063178dff517285fffa98cfff2aff0000057b0f00ea31b10949fd00240ca100e1855f005b6c27004b9cf3ffcaff0000067b0f008611511b5efd00210ca10011793600d107d8ff367894ff3b000200077b0f00dd7ca1054ffd00880da10015afb6ff0fdda1ff9ad67000ed000200087b0f008834e80f3afd00b80ca1005bf60a00917102008893e7ffdeff0000097b0f00af106c0746fd005b0da1009ffe8aff94db49006642f6ff88fe00000a7b0f00ef371c1256fd00000da10093f3600062dd96ffd82d390040fffeff0b7b0f003104610b4afdff190da100c8c4380007ab4c00aad80a00240001000c7b0f009443a3134cfd00300da100f2f8e3ff311232001cb75200a9ffffff0d7b0f00322bf51055fd00050da100ca1991ffbb0327000a5eceffb40001000e7b0f005308d70840fd00c60ca100d4d0e2ffc1aa7c001b6352001800feff0f7b0f00936e9ff732fd00c60ca10095df86ff6e3a2900dd28c0ff7aff0100107b0f00d663ac134bfd00900da10011bce4ff8da61b0045e0080078fefeff117b0f00166e9a194afd00cd0ca100962f0e006268c0ff5e07e6ff02020200127b0f00e10e161150fd00db0ca1003a3d37008f677600c1b297ff5d01ffff137b0f00a14bad184afd00cf0ca100740510005f234e009d6a47002a000100147b0f00362deffd39fd00a20ca10020045b003d2079000b6fb9ff21020000157b0f00f9c4f00948fd00da0ca100d54e3300b43cd3ffa103eaff90000100167b0f00d237ccfb36fd009f0da10066e65c007cfedaff557cb8ffccfd0300177b0f00a70cd80e52fd00ea0ca10046fa5f00f8fc6b00a54779004a00ffff187b0f00265dd9fa41fd00480da1002170b3ff277e1e0085b398ffdb000300197b0f009450600b42fd004c0ca1002bf0e0ff43772700df144b00c90002001a7b0f003431e8fe34fd006e0ca100e929dfff79fd0b00bec82f00810001001b7b0f00754d851542fd00240da10016b10b0085ee190054aae2ff45fffeff1d7b0f003e10d81a4cfd00640ca10034b30e00432e5d00db7ce6ff60fefeff1e7b0f00ea2bfbfb41fd00d90ca1006755b7ffaba990ffd74c6b001bfeffff1f7b0f00b7526c0853fd004f0ca1005d64b7ff26610b00e7425d0073ffffff207b0f007829fd0949fd002e0da100e56a8bff4d969fffc6c701000800ffff0401000502fffe2603fffc061e00017a0001027a0001037a0001047a0001057a0001067a0001077a0001087a0001097a00010a7a00010c7a00010d7a00010e7a00010f7a0001107a0001117a0001127a0001137a0001147a0001157a0001167a0001177a0001187a0001197a00011a7a00011b7a00011d7a00011e7a00011f7a0001207a00010701005b3b59be00000000000000000000000009010000040008080100bf325a000b69070000004141007f44
      """
    And I enqueue this mock HTTP API response with status code 200 for a HEAD request to api.nrfcloud.com/v1/location/agps?customTypes=2&eci={agpsCellId}&mcc={agpsMcc}&mnc={agpsMnc}&requestType=custom&tac={agpsArea}
      """
      Content-Type: application/octet-stream
      Content-Length: 1864

      """
    And I enqueue this mock HTTP API response with status code 200 for a GET request to api.nrfcloud.com/v1/location/agps?customTypes=2&eci={agpsCellId}&mcc={agpsMcc}&mnc={agpsMnc}&requestType=custom&tac={agpsArea}
      """
      Content-Type: application/octet-stream

      01021e0001006400c675009cff859f13000b0000c67536bffd23342caffce544bfa9ffff0d09aa05f103f0740da1db2421284e1dc63b09030b00d015221863ffa20202002e00c67500ebff537cebffda0000c675497fe3c2c92fdf76685046abfffffc255a0a220252e40da180f34127e6da4a38150269ff87136f18ad00780103000a00c575008bff60b7f7ff040000c575f0e29b261e34f983551979a4ffff0c50f40198ffdb490ea1ef01892736bf08669afe1600470a1724f1ffe3fe04005900c67500fdff1552f9fff70000c6752a9bdc850a31dfc6ac8a67a8ffffa4e3ad00c3fb4cac0da13d5f2727dbe10e9202f9f8ffd21533161b00cff905005400c67500f5ff3d54feffe80000c67585665b27f5358e0015af4fa4ffff9e7c1f03ac004a8b0ca14cdb0027479e7d6453fe1c00300993242900a5fe06005900c67500380094d00100080000c6751f0011d88a2c2319d74f99aaffffff6b190188027b700ca107451b281e0b703b3c02d8ffa313231a1b003b0207004600c675004700d1570700e80000c675fc21d8a1e331da5e602c7ca5ffffa0afcc07040146030ea151aec026d288a6bbeb0623006a1725148fff6d0608001b00c67500f3ff7deffeff0b0000c67597587902ac30f7bfffa2c9a7ffff11b2470355fd091e0da1543f65274828ee0f68f9c0ff5413041ae9ff04fa09001600c67500f7ff323ff4ff030000c6752918cd4940336700d2b106a7ffff93ce08011dfbafd70da16582dd26ea55f68fa1f80e007114791726005af90a002d00c67500bcff070cfaff050000c6759902de964234f38ba6f4c0a3ffff66c17c039efe095d0da1c08a87276c0beb654bfd29005d092325160058fd0c004900c67500d1ff504dfdffe50000c675df431332eb312a4f330e06a4ffff94a93904a5ff6e8d0da11a95a0279989f0e8a5011d00b1094325d7ffdf000d008300c675002e00bc980500e80000c675cb0cf226142dff24ea8947abffff3b2ab10269fd7c7d0da1852676271e1111967df907006e161e16eeff8afa0e008302c67500b4ff86cf0000ef0000c675e9e76c7c5736afab150e3ea3ffff80818400c200df230da105d6f32659c5c8e7990211000309c024f5ff5d020f000600c575001800abc8fbffe90000c575815e2929ea375089967b5ba6ffffb790e70645fc88530da17b82e0253fe5d78b42f7a9ffa6129e17180066f810001000c67500c9ffa1c6f3ffea0000c675400daa1bd7317e9061c4dfa5fffffcd53c06d200ace30da1fb1fa127c4aeb3e91e01b3ff3f08b5256f00f10011000e00c675003300e8031000e80000c67526f162c02e2cde7d82a139acffffead1df0622fed12a0da1cb5c0028b10b271396f92700ac12ca1a6800c7fa1200e303c67500e2ff87ea0a00ee0000c6759b076c7635315022255357a7ffff3a7eec005103e33a0da1478077278e86343c35052600c5127f1a1a00b80413002200c675002c00f2470100df0000c67580ae104e902d912ef3020fa8ffff979dba04c3fd082a0da18494f1272de7fc1445fab5ff7913b61ad2fff6fa1400a400c67500feff5b071100ee0000c6755ba60c79f639a85cf4749da2ffffbcdfd202d300740f0da119a844265340fc5f67001a008e094823b3ff500015006a00c675001300207d0400ea0000c675788c34d3ef30577982a51dabffffba67500cda036b440da18d440527e074463844050a016a16dc141e005c0516001800c6750053002a54eeffda0000c6757f81feda3c3c9c440274b5a1ffffa9cf7d039d0095110ea1c76b22263199de61180043004409e4222900280017000101c67500d3ffb9560200ee0000c6755456a56b7535c2c21635f5a3ffffb71dc900d4fedb490da1df5453278dd7f164f2fdebffa2088025120027fe18003e00c675006400acc80600060100c6759a787b1e66353fe235548ea5ffff60d0d00584028ccb0da1423414265ff167b8a306adff0715961589ffa40519000500c5750039009b3d06000c0000c5759bd17a27a2351a2364062ea2ffffa21c09052000aead0ca108541c273305e8e5960256000f099725ecff09021a005400c675002700ba0004000f0000c675fecf020c4f3a621331ebf29fffff46091203d80029d20ca102c854263b2722e49902f4ffe507ac243e0086021b002a00c67500cfff742dfaff040000c6757116f219d62d1d68239e91a9ffff6000d704cafdff8a0da1b91dbf2762b2a810fff9b0ff01143f19490048fa1d003900c67500ccff9a09f3ffea0000c6754b23095d092c666e0fa2baaaffff155504013dfea9c90ca1c63414289b98aa1369fb19001c14361ae9ff4dfc1e004100c67500dcff89def0ff080000c675fddf9c908235d491d026b2a5ffffd432be0267020d550da193452626cd314dbcb50742000a15a415cdff0d071f008300c67500eeff809bfbffe40000c67566c1580b9a30e41db718eea6ffff19ec2a05fb02c8bd0ca1a563ed261abb5bbc3b098e008e1441173500600820000d00c67500e8fffa420000010000c6757f20b29f1131d46929bd2ba9fffff058970206fcbaa40da1f88e06278c7f629027fad8ff8515fe163d00d5fa
      """
    And I store "$millis()" into "ts"
    And the tracker "{trackerId}" updates its reported state with
            """
            {
            "dev": {
                "v": {
                    "nw": "LTE-M GPS"
                },
                "ts": {ts}
            }
            }
            """

  Scenario: Request A-GPS data

    The response should be split into two messages,
    because A-GPS Ephemerides data is so large it cannot
    be combined with other types

    When the tracker "{trackerId}" publishes this message to the topic {trackerId}/agps/get
      """
      {
        "mcc": {agpsMcc},
        "mnc": {agpsMnc},
        "cell": {agpsCellId},
        "area": {agpsArea},
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
    Then the tracker "{trackerId}" receives 2 raw messages on the topic {trackerId}/agps into "agpsData"
    And  "$length($filter(agpsData, function($v) { $contains($v, '01010100f9fffffffeffffff0f7b12890612031f00017') })) > 0" should be true
    And  "$length($filter(agpsData, function($v) { $contains($v, '01021e0001006400c675009cff859f13000b0000c6753') })) > 0" should be true