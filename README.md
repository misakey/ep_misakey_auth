ep_misakey_auth
=======

Misakey OIDC auth plugin for etherpad-lite,

This plugin uses a passport.js strategy for OpenID Connect authentication,
through **passport-openidconnect** by [jaredhanson](https://github.com/jaredhanson/passport-openidconnect)

This plugin is mostly based on ep_oidc plugin by [ToniIltanen](https://github.com/ToniIltanen/ep_oidc)

## Motivation

We rewrote this plugin because the original OIDC plugin wasn't working:
- configuration wasn't taken into account (our analysis: the settings system has changed in etherpad)
- the plugin didn't set a state when launching the process, this state is required in our OIDC Server
- we were stuck in a redirect loop when trying to get the access token
- the plugin didn't have any authorization part. We added one here

## Settings configuration

You must add the required keys to etherpad settings (here with example values):


``` json
    "users": {
        "oidc": true,
    },
    "ep_mk_oidc": {
        "client": {
            "clientID": "00000000-0000-0000-0000-00000000",
            "clientSecret": "yourClientSecret",
            "callbackURL": "https://your.pad.tld/auth/callback",
        },
        "usersSub": ["subOfFirstUser", "subOfSecondUser"],
        // You can disable the authorization for users (any connected user will work)
        // but setting "usersSub": false,
        "adminsSub": ["subOfFirstAdmin"]
    },
 }
```

## Authorization

The authorization is only done by sub for now. So you'll need to ask your users to try to connect, 
then give you their sub (given in unauthorized screen). 

We'll have soon in Misakey a way to give in the ID token directly the email the user want to share,
so you'll be able to set your authorization with email address.


## License

MIT

## Antoine todo

* Build some UI for the error / sucess messages

* Cleanup everything
* Publish a package !
