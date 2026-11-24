{
  "targets": [
    {
      "target_name": "wincred_native",
      "sources": [ "wincred-addon.cc" ],
      "conditions": [
        [ "OS=='win'", { "libraries": [ "Advapi32.lib", "Bcrypt.lib" ] } ]
      ]
    },
    {
      "target_name": "wincred_test",
      "sources": [ "wincred-addon.cc" ],
      "defines": [ "SA_WINCRED_TEST" ],
      "conditions": [
        [ "OS=='win'", { "libraries": [ "Advapi32.lib", "Bcrypt.lib" ] } ]
      ]
    }
  ]
}
