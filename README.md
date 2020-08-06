# Making Do Recipes

An Elasticsearch and React App to find and share recipes for people with allergies.

## Run
1. Clone this repo and `cd` into it.
2. Set environment variables. (Important to do this before 3, because the following step will build the React app which looks at environment variables)
3. `npm install`
4. `npm start`

## Environment Variables
`ELASTICSEARCH_HOST` - The Elasticsearch connection string
`ADMIN_USERNAME` - The admin username
`ADMIN_PASSWORD` - MD5 hex of the admin password
`TOKEN_KEY` - Key to create token cookie for login
`REACT_APP_TINY_KEY` - API key for Tiny Cloud

## Admin Login
Run the following in the console on the site:
`fetch("/login", {method: 'POST',headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "username": <USERNAME>, "password": <PASSWORD> }) } );`
Replacing `<USERNAME>` and `<PASSWORD>` accordingly. A cookie will be set appropriately.

## Development
When you run `npm install` it will build the react app present in `/assets`. You may want to run the react server, so you get nice features such as auto-refresh. To do this, simply `cd` to `/assets` and run `npm start` while the main server is also running.

## Running tests
Set the `ELASTICSEARCH_HOST`,`TEST_USERNAME`, and `TEST_PASSWORD` environment variables to the Elasticsearch host string, admin username, and admin password (not MD5'd) respectively.
Then run: `node tests/test.js`

## Credits
Logo - logomaker.com (logomakr.com/0crQUx)
Special Thanks to all the npm package authors

![Making Do Recipes Logo](https://github.com/jamesgrams/makingdorecipes/blob/master/assets/public/logo.png?raw=true)