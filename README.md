# Making Do Recipes

An Elasticsearch and React App to find and share recipes for people with allergies.

## Run
1. Clone this repo and `cd` into it.
2. Make sure Elasticsearch is setup. You will need to `PUT /recipe` the contents of `mappings/mapping.json`. Do the same with `mappings/mapping.json` into `/subscription`.
3. Set environment variables. (Important to do this before 3, because the following step will build the React app which looks at environment variables)
4. `npm install`
5. `npm start` or `heroku local web`

## Environment Variables
* `ELASTICSEARCH_HOST` - The Elasticsearch connection string
* `ADMIN_USERNAME` - The admin username
* `ADMIN_PASSWORD` - MD5 hex of the admin password
* `TOKEN_KEY` - Key to create token cookie for login
* `REACT_APP_TINY_KEY` - API key for Tiny Cloud
* `REACT_APP_GA_TRACKER` - Google Analytics tracking code
* `NODE_ENV` - Set to to `development` to avoid the HTTPS redirect
* `PORT` - Completely optional - sets the port of the Express server
* `MAILER_EMAIL` - The email address to send emails from
* `MAILER_PASSWORD` - The password of the email to send emails from
* `MAILER_HOST` - The SMTP host to send emails from
* `MAILER_PORT` - The port to send emails from

## Admin Login
Visit `/login.html` and login. A cookie will be set appropriately. You will then be allowed to search for unapproved recipes, edit recipes, delete recipes, and approve recipes. To approve a recipe, simply edit and submit it while logged in.

## Development
When you run `npm install` it will build the react app present in `/assets`. You may want to run the react server, so you get nice features such as auto-refresh. To do this, simply `cd` to `/assets` and run `npm start` while the main server is also running. You will want to set the `DEVELOPMENT` environment variable. You may need to change the proxy line in `/assets/package.json` to point to the correct port of the Express server.

## Running tests
Set the `ELASTICSEARCH_HOST`,`TEST_USERNAME`, and `TEST_PASSWORD` environment variables to the Elasticsearch host string, admin username, and admin password (not MD5'd) respectively.
Then run: `node tests/test.js`.
The output should not throw any errors or display anything in red. In addition, it should tell you when bad documents are blocked.

## Updating Elasticsearch Index
1. PUT the `mapping.json` file contents to `/recipe_test`
2. Run:
```
POST _reindex
{
  "source": {
    "index": "recipe"
  },
  "dest": {
    "index": "recipe_test"
  }
}
```
3. Do a test search to make sure all the documents copied to recipe_test
4. `DELETE /recipe`
5. PUT the `mapping.json` file contents to `/recipe`
6. Run
```
POST _reindex
{
  "source": {
    "index": "recipe_test"
  },
  "dest": {
    "index": "recipe"
  }
}
```
6. Make sure all the results are now available on Making Do Recipes and run `DELETE /recipe_test`

## Credits
Logo - logomaker.com (logomakr.com/0crQUx)
Special Thanks to all the npm package authors

![Making Do Recipes Logo](https://github.com/jamesgrams/makingdorecipes/blob/master/assets/public/logo.png?raw=true)