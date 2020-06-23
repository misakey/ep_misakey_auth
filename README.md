ep_misakey_auth
=======

Add easily authentication and authorization to your etherpad-lite instance, relying to Misakey's SSO.

You can configure your instance to be force user to sign-in to access your pads, and allow specific 
emails or domains to access the instance.

**Bonus:** you can also configure the admin access !


## Settings configuration

You must add the required keys to etherpad `settings.json` (here with example values):


``` jsonc
    "requireAuthentication": true,
    "requireAuthorization": true,
    "users": {
        "misakey": true,
    },
    "ep_misakey_auth": {
        "clientID": "d3f70c03-fb3f-4296-9d8b-47d93427ff9b",
        "clientSecret": "secret",
        "callbackURL": "http://localhost:9001/auth/callback",
        // For admin & users, you can either give emails or domains
        // (all emails from those domains will work)
        "users": ["misakey.com", "joni@coolmail.com"],
        // You can disable the authorization for users (any connected user will work)
        // but setting "users": false,
        "admins": ["joni@michel.fr"] 
    },
 }
```

## Authorization

The authorization is managed at email level. Misakey SSO return a token attached to an email,
you can configure which email has access to your app (or a group of emails).

It's written in the `settings.json` file: `ep_misakey_auth.users` is an array of emails and domains
(adding a domain will allow any user with an email @domain.tld to connect). 

`ep_misakey_auth.admins` is a similar array to give access to the `/admin` part of your Etherpad instance.

## Getting it in production ?

You can easily hack arround with the public local client (client ID: `d3f70c03-fb3f-4296-9d8b-47d93427ff9b`; client secret `secret` ; callback: `http://localhost:9001/auth/callback`).

If you want to use it on production, you'll need a SSO client. To do that send us an email at [join@misakey.com](mailto:join@misakey.com).
As we are in private beta, client creation isn't accessible without invitation for now.

## License

MIT

## Credits

This plugin uses a passport.js strategy for OpenID Connect authentication,
through **passport-openidconnect** by [jaredhanson](https://github.com/jaredhanson/passport-openidconnect)

This plugin is mostly based on ep_oidc plugin by [ToniIltanen](https://github.com/ToniIltanen/ep_oidc)
