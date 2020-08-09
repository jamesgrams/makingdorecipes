/**
 * Endpoints for interacting with the Elasticsearch backend of Making Do Recipes.
 * @author  James Grams
 */

 // TODO fix logo
 // TODO data backups

/******************************************* Constants *********************************************/

const express = require('express');
const elasticsearch = require("elasticsearch");
const jwt = require('jsonwebtoken');
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const pluralize = require("pluralize");
const striptags = require("striptags");
const fs = require("fs");
const aws = require('aws-sdk');
const { v1: uuidv1 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const { parse } = require('node-html-parser');
const compression = require('compression')

const PORT=process.env.PORT || 80;
const ELASTICSEARCH_INDEX = "recipe";
const ELASTICSEARCH_FUZZINESS = "AUTO";
const RESULTS_SIZE = 10;
const MAX_SUGGESTIONS = 7;
const ELASTICSEARCH_INNER_HITS_COUNT = 100;
const HTTP_OK = 200;
const HTTP_SEMANTIC_ERROR = 422;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_REDIRECT = 301;
const SUCCESS = "success";
const FAILURE = "failure";
const TOKEN_COOKIE = "making-do-recipes-token";
const TOKEN_OPTIONS = {"expiresIn": "2d"};
const TOKEN_EXPIRES_IN_MS = 172800000;
const BAD_REQUEST = "Bad Request";
const REPLACE_TITLE_PLACEHOLDER = "REPLACE_TITLE_PLACEHOLDER";
const REPLACE_DESCRIPTION_PLACEHOLDER = "REPLACE_DESCRIPRION_PLACEHOLDER";
const OG_PLACEHOLDER = "OG_PLACEHOLDER";
const AWS_S3_BUCKET=process.env.AWS_S3_BUCKET;

/****************** Setup connection to Elasticsearch and start the Express app. ******************/

let indexFile = fs.readFileSync("assets/build/index.html").toString(); // keep this file in memory on startup
indexFile = indexFile.replace(/(?<=<title>)[^<]+(?=<\/title>)/,REPLACE_TITLE_PLACEHOLDER);
indexFile = indexFile.replace(/(?<=<meta name="description" content=")[^"]+/,REPLACE_DESCRIPTION_PLACEHOLDER);
indexFile = indexFile.replace(/(?=<\/head>)+/,OG_PLACEHOLDER);

aws.config.region = "us-east-1";

const client = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH_HOST,
    apiVersion: '7.2'
});
const app = express();
app.use(compression());
// Redirect the app
app.use((req,res,next) => {
    // HTTPs
    if (!req.secure && req.get('x-forwarded-proto') !== 'https' && process.env.NODE_ENV !== "development") {
        return res.redirect(HTTP_REDIRECT, 'https://' + req.get('host') + req.url);
    }
    // www
    if (req.header("host").slice(0, 4) === 'www.') {
        let newHost = req.header("host").slice(4);
        return res.redirect(HTTP_REDIRECT, req.protocol + '://' + newHost + req.originalUrl);
    }
    // heroku
    if (req.header("host").match(/herokuapp\..*/i)) {
        res.redirect(HTTP_REDIRECT, req.protocol + '://makingdorecipes.com' + req.url);
    }
    next();
});
app.use( express.json() );
app.use(cookieParser());
app.use("/", express.static("assets/build"));
app.use("/add", express.static("assets/build/index.html"));

// For the Facebook Crawler, we can't set og tags dynamically with React Helmet
// So we need to inject them
// Make sure this matches what's in ResultListItem.js Helmet just like index.html should match the main Search.js Helmet.
app.use("/recipe/:id", async (req, res, next) => {
    
    let recipes = await getRecipes(req.params.id);
    recipes = recipes.recipes;
    if( !recipes.length ) {
        next();
        return;
    }
    let recipe = recipes[0];
    let title = recipe.name + " - Making Do Recipes";
    let url = "https://makingdorecipes.com/recipe/" + recipe.id;
    let description = recipe.steps.replace(/<[^>]+>/g, '').replace(/\r?\n|\r/g," ").replace(/\s{2,}/," ").trim();

    let editedIndexFile = indexFile;
    editedIndexFile = editedIndexFile.replace(REPLACE_TITLE_PLACEHOLDER, title);
    editedIndexFile = editedIndexFile.replace(REPLACE_DESCRIPTION_PLACEHOLDER, description);
    editedIndexFile = editedIndexFile.replace(OG_PLACEHOLDER, `<meta property="og:title" content="${title}" data-react-helmet="true"/><meta property="og:type" content="article" data-react-helmet="true"/><meta property="og:url" content="${url}" data-react-helmet="true"/><meta propery="og:description" content="${description}" data-react-helmet="true"/><meta property="twitter:card" content="summary" data-react-helmet="true"/><meta property="twitter:title" content="${title}" data-react-helmet="true"/><meta propery="twitter:description" content="${description}" data-react-helmet="true"/>`);

    res.end(editedIndexFile);
});

/******************************************* Endpoints *********************************************/

// get recipes
app.get("/recipe", async function(request, response) {
    console.log( "serving /recipe with query " + JSON.stringify(request.query) );
    try {
        // To reach recipes yet to be approved, you must be an admin.
        if( request.query.unapproved || request.query.all ) {
            let authorized = await isLoggedIn(request.cookies[TOKEN_COOKIE]);
            if( !authorized ) {
                writeResponse(response, FAILURE, null, HTTP_UNAUTHORIZED);
                return;
            }
        }
        let recipes = await getRecipes(request.query.id, request.query.search, request.query.tags ? request.query.tags.split(",") : null, request.query.safes ? request.query.safes.split(",") : null, request.query.allergens ? request.query.allergens.split(",") : null, request.query.flexibility ? parseInt(request.query.flexibility) : 0, request.query.prefix ? true : false, request.query.unapproved ? true : false, request.query.all ? true : false, parseInt(request.query.from) );
        writeResponse(response, SUCCESS, recipes);
    }
    catch(err) {
        console.log(err);
        writeResponse(response, FAILURE, null, HTTP_SEMANTIC_ERROR);
    }
});

// get options prefix search
app.get("/tag", async function(request, response) {
    console.log( "serving /tag with query " + JSON.stringify(request.query) );
    try {
        let tags = await getTagsPrefix(request.query.search);
        writeResponse(response, SUCCESS, {"tags":tags});
    }
    catch(err) {
        console.log(err);
        writeResponse(response, FAILURE, null, HTTP_SEMANTIC_ERROR);
    }
});

// get options prefix search
app.get("/option", async function(request, response) {
    console.log( "serving /option with query " + JSON.stringify(request.query) );
    try {
        let options = await getOptionsPrefix(request.query.search);
        writeResponse(response, SUCCESS, {"options":options});
    }
    catch(err) {
        console.log(err);
        writeResponse(response, FAILURE, null, HTTP_SEMANTIC_ERROR);
    }
});

// get allergens prefix search
app.get("/allergen", async function(request, response) {
    console.log( "serving /option with query " + JSON.stringify(request.query) );
    try {
        let allergens = await getAllergensPrefix(request.query.search);
        writeResponse(response, SUCCESS, {"allergens":allergens});
    }
    catch(err) {
        console.log(err);
        writeResponse(response, FAILURE, null, HTTP_SEMANTIC_ERROR);
    }
});

// get allergens for a particular option
app.get("/option-allergen", async function(request, response) {
    console.log( "serving /option with query " + JSON.stringify(request.query) );
    try {
        let allergens = await getAllergens(request.query.option);
        writeResponse(response, SUCCESS, {"allergens":allergens});
    }
    catch(err) {
        console.log(err);
        writeResponse(response, FAILURE, null, HTTP_SEMANTIC_ERROR);
    }
});

// login
app.post("/login", function(request, response) {
    console.log( "serving /login" );
    try {
        let token = login( request.body.username, request.body.password );
        if( token ) {
            response.cookie(TOKEN_COOKIE, token, { "maxAge": TOKEN_EXPIRES_IN_MS });
            writeResponse(response, SUCCESS, null, HTTP_OK);
        }
        else {
            writeResponse(response, FAILURE, null, HTTP_UNAUTHORIZED);
        }
    }
    catch(err) {
        console.log(err);
        writeResponse(response, FAILURE, null, HTTP_SEMANTIC_ERROR);
    }
});

// index a post
app.put("/recipe", async function(request, response) {
    console.log( "serving /recipe with body " + JSON.stringify(request.body) );
    try {
        let authorized = await isLoggedIn(request.cookies[TOKEN_COOKIE]);
        if( authorized || (!request.body.approved && !request.body.id) ) { // we can index non-approved items
            let id = await indexRecipe( request.body.id, request.body.name, request.body.tag, request.body.steps, request.body.approved, request.body.ingredient, request.body.credit );
            writeResponse(response, SUCCESS, {"id":id});
        }
        else {
            writeResponse(response, FAILURE, null, HTTP_UNAUTHORIZED);
        }
    }
    catch(err) {
        console.log(err);
        writeResponse(response, FAILURE, null, HTTP_SEMANTIC_ERROR);
    }
} );

// delete a post
app.delete("/recipe", async function(request, response) {
    console.log( "serving /recipe" );
    try {
        let authorized = await isLoggedIn(request.cookies[TOKEN_COOKIE]);
        if( authorized ) {
            let status = await deleteRecipe( request.query.id );
            writeResponse(response, SUCCESS, {"es-status":status});
        }
        else {
            writeResponse(response, FAILURE, null, HTTP_UNAUTHORIZED);
        }
    }
    catch(err) {
        console.log(err);
        writeResponse(response, FAILURE, null, HTTP_SEMANTIC_ERROR);
    }
} );

// Respond to upload requests for images
app.get("/sign-s3", (req,res) => {
    let s3 = new aws.S3();
    let fileName = uuidv1() + req.query['extension'];
    //let fileType = req.query['type'];
    let s3Params = {
        Bucket: AWS_S3_BUCKET,
        Fields: {
            Key: fileName,
            acl: "public-read"
        },
        Expires: 60,
        Conditions: [
            {'acl': 'public-read'},
			["content-length-range", 0, 3000000], // content length restrictions: 0-3MB
            ["starts-with", "$Content-Type", "image/"] // content type restriction
		]
    };

    let data = s3.createPresignedPost(s3Params);

    res.json(data);
    res.end();
});

//The 404 Route (ALWAYS Keep this as the last route)
app.get('*', function(req, res){
    res.status(HTTP_NOT_FOUND).send("404 - Uh oh! It looks like you are lost. <a href='/'>Click here to go to the Homepage.</a>");
});

// listen
app.listen(PORT);

/**
 * Send a response to the user.
 * @param {Response} response - The response object.
 * @param {string} status - The status of the request.
 * @param {Object} object - An object containing values to include in the response.
 * @param {number} code - The HTTP response code (defaults to 200).
 * @param {string} contentType - The content type of the response (defaults to application/json).
 */
function writeResponse( response, status, object, code, contentType ) {
    if( !code ) { code = HTTP_OK; }
    if( !contentType ) { contentType = "application/json"; }
    if( !object ) { object = {}; }
    response.writeHead(code, {'Content-Type': 'application/json'});
    
    let responseObject = Object.assign( {status:status}, object );
    response.end(JSON.stringify(responseObject));
}

/******************************************* Functions *********************************************/

/**
 * Get Recipes.
 * @param {String} [id] - The id of the document.
 * @param {String} [search] - The search query. 
 * @param {Array<String>} [tags] - Tags to match by.
 * @param {Array<String>} [safes] - The list of safes or null if none.
 * @param {Array<String>} [allergens] - The list of allergens - safes must be null.
 * @param {Number} [flexibility] - The allowed number of bad ingredients.
 * @param {boolean} [prefix] - True if the search should be a prefix search.
 * @param {boolean} [unapproved] - True if unapproved recipes should be the in the result (restricted to admins).
 * @param {boolean} [all] - True if we should fetch all (restricted to admins and overrides unapproved value).
 * @param {number} [from] - The starting position.
 * @returns {Promise<Array>} - A promise containing an array of all the response objects.
 */
async function getRecipes( id, search, tags, safes, allergens, flexibility=0, prefix=false, unapproved=false, all=false, from=0 ) {

    // Error check
    if( id && !errorCheckType(id, "string") ) return Promise.reject(BAD_REQUEST);
    if( search && !errorCheckType(search, "string") ) return Promise.reject(BAD_REQUEST);
    if( tags && !errorCheckType(tags, "array") ) return Promise.reject(BAD_REQUEST);
    if( tags && tags.filter(el => !errorCheckType(el, "string")).length ) return Promise.reject(BAD_REQUEST);
    if( safes && !errorCheckType(safes, "array") ) return Promise.reject(BAD_REQUEST);
    if( safes && safes.filter(el => !errorCheckType(el, "string")).length ) return Promise.reject(BAD_REQUEST);
    if( allergens && !errorCheckType(allergens, "array") ) return Promise.reject(BAD_REQUEST);
    if( allergens && allergens.filter(el => !errorCheckType(el, "string")).length ) return Promise.reject(BAD_REQUEST);
    if( flexibility && !errorCheckType(flexibility, "number") ) return Promise.reject(BAD_REQUEST);
    if( prefix && !errorCheckType(prefix, "boolean") ) return Promise.reject(BAD_REQUEST);
    if( unapproved && !errorCheckType(unapproved, "boolean") ) return Promise.reject(BAD_REQUEST);
    if( all && !errorCheckType(all, "boolean") ) return Promise.reject(BAD_REQUEST);
    if( from && !errorCheckType(from, "number") ) return Promise.reject(BAD_REQUEST);

    // This array will contain all the parts of our search - search, tags, and allergens.
    let searchParts = [];

    if( id ) {
        searchParts.push({
            "term": {
                "_id": id
            }
        });
    }
    // unapproved filter
    if( !all ) {
        searchParts.push({
            "term": {
                "approved": !unapproved
            }
        });
    }
    // search query
    if( search ) {
        if( prefix ) {
            // bool prefix is what elasticsearch recommends for search as you type
            searchParts.push({
                "multi_match": {
                    "query": search,
                    "type": "bool_prefix",
                    "fields": [
                        "name",
                        "name._2gram",
                        "name._3gram"
                    ],
                    "fuzziness": ELASTICSEARCH_FUZZINESS
                }
            });
        }
        else {
            searchParts.push({
                "match": {
                    "name": {
                        "query": search,
                        "fuzziness": ELASTICSEARCH_FUZZINESS
                    }
                }
            });
        }
    }
    // tags
    if( tags ) {
        searchParts.push({
            "bool": {
                "should": tags.map( tag => { return { 
                    "nested": {
                        "path": "tag",
                        "query": {
                            "match_phrase": {"tag.name": tag} }
                        }
                    }
                })
            }
        });
    }
    // safes and allergens
    if( safes || allergens ) {
        let mustArray = [];
        let iterateArray;
        if( safes ) iterateArray = safes;
        else iterateArray = allergens;
        for( let item of iterateArray ) {
            mustArray.push({
                "match_phrase": {"ingredient.option.allergen.name": item}
            });
        }

        // See test.json for an explanation of what is going on here.
        let allergensSection;
        
        if( safes ) {
            allergensSection = {
                "bool": {
                    "must_not": {
                        "function_score": {
                            "query": {
                                "nested": {
                                    "path": "ingredient",
                                    "score_mode": "sum",
                                    "query": {
                                        "constant_score": {
                                            "boost": 1,
                                            "filter": {
                                                "bool": {
                                                    "must_not": {
                                                        "nested": {
                                                            "path": "ingredient.option",
                                                            "query": {
                                                                "bool": {
                                                                    "must_not": {
                                                                        "nested": {
                                                                            "path": "ingredient.option.allergen",
                                                                            "query": {
                                                                                "bool": {
                                                                                    "must_not": mustArray
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            "min_score": flexibility+1
                        }
                    }
                }
            };
        }
        else {
            console.log(flexibility+1);
            allergensSection = {
                "bool": {
                    "must_not": {
                        "function_score": {
                            "query": {
                                "nested": {
                                    "path": "ingredient",
                                    "score_mode": "sum",
                                    "query": {
                                        "constant_score": {
                                            "filter": {
                                                "bool": {
                                                    "must_not": {
                                                        "nested": {
                                                            "path": "ingredient.option",
                                                            "query": {
                                                                "bool": {
                                                                    "must_not": {
                                                                        "nested": {
                                                                            "path": "ingredient.option.allergen",
                                                                            "query": {
                                                                                "bool": {
                                                                                    "should": mustArray
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }                 
                                                        }
                                                    }
                                                }
                                            },
                                            "boost": 1
                                        }
                                    }
                                }
                            },
                            "min_score": flexibility+1
                        }
                    }
                }
            };
        }

        searchParts.push(allergensSection);
    }
    
    let body = {
        "size": RESULTS_SIZE,
        "query": {
            "bool": {
                "must": searchParts
            }
        }
    };

    if( from ) {
        body.from = from;
    }

    let response = await client.search({
        index: ELASTICSEARCH_INDEX,
        body: body
    });

    
    let responseVal = [];
    if( response.hits.hits.length ) {
        responseVal = response.hits.hits.map( el => { return{...el._source, "id":el._id} } );
    }
    let total = response.hits.total.value;

    return Promise.resolve({
        total: total,
        recipes: responseVal
    });
}

/**
 * Get Tags by Prefix.
 * To be used to suggest tags to users.
 * @param {String} search - The prefix to search by.
 * @returns {Promise<Array>} - An array of suggestions ordered by most commonly occuring match. 
 */
async function getTagsPrefix( search ) {

    if( !errorCheckType(search, "string") ) return Promise.reject(BAD_REQUEST);

    let body = {
        "query": {
            "bool": {
                "filter": {
                    "term": {
                        "approved": true
                    }
                }
            }
        },
        "size": 0,
        "aggs": {
            "recipes": {
                "nested": {
                    "path": "tag"
                },
                "aggs": {
                    "tags": {
                        "filter": {
                            "multi_match": {
                                "query": search,
                                "type": "bool_prefix",
                                "fields": [
                                        "tag.name",
                                        "tag.name._2gram",
                                        "tag.name._3gram"
                                ]
                            }
                        },
                        "aggs": {
                            "tags_filtered": {
                                "terms": {
                                    "field": "tag.name.keyword"
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    let response = await client.search({
        index: ELASTICSEARCH_INDEX,
        body: body
    });

    return Promise.resolve(response.aggregations.recipes.tags.tags_filtered.buckets.map(el => el.key));
}

/**
 * Get Options by Prefix.
 * To be used to suggest options to users.
 * @param {String} search - The prefix to search by.
 * @returns {Promise<Array>} - An array of suggestions ordered by most commonly occuring match. 
 */
async function getOptionsPrefix( search ) {

    if( !errorCheckType(search, "string") ) return Promise.reject(BAD_REQUEST);

    let body = {
        "_source": false,
        "query": {
            "bool": {
                "filter": {
                    "term": {
                        "approved": true
                    }
                },
                "must": [
                    {
                        "nested": {
                            "inner_hits": {"size":ELASTICSEARCH_INNER_HITS_COUNT,"_source":false},
                            "path": "ingredient",
                            "query": {
                                "nested": {
                                    "inner_hits": {"size":ELASTICSEARCH_INNER_HITS_COUNT,"_source":"ingredient.option.name_suggestable"},
                                    "path": "ingredient.option",
                                    "query": {
                                        "bool": {
                                            "should": [
                                                {
                                                    "multi_match": {
                                                        "query": search,
                                                        "type": "bool_prefix",
                                                        "fuzziness": ELASTICSEARCH_FUZZINESS,
                                                        "fields": [
                                                                "ingredient.option.name",
                                                                "ingredient.option.name._2gram",
                                                                "ingredient.option.name._3gram"
                                                        ]
                                                    }
                                                },
                                                {
                                                    "match": {
                                                        "ingredient.option.name": {
                                                            "query": search,
                                                            "fuzziness": ELASTICSEARCH_FUZZINESS // The bool prefix query doesn't search for fuzinness on the last item in the list, but we can here
                                                        }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
    };

    let response = await client.search({
        index: ELASTICSEARCH_INDEX,
        body: body
    });

    // We have to aggregate at the application level, since in Elasticsearch, there is no way for us to 
    // get the nested document score in the nested aggregation. A nested aggregation (terms bucket on name_suggestable) could get us the documents
    // that match for each bucket, and ideally we would sort the buckets by their max score, but the score
    // returned is the score for the root document which has already averaged out of all the scores of its nested documents (meaning all options for a recipe would have the same value). 
    // The only way to get the nested score is through inner hits.
    // This article explains sortiny by score - but that score is for the root, even though nested top_hits nicely returns the source of the nested match, it still gives the root doc score.
        
    let buckets = {}; // keys = name_suggestable, value = max_score
    for( let recipeHit of response.hits.hits ) {
        for( let ingredientHit of recipeHit.inner_hits.ingredient.hits.hits ) {
            for( let optionHit of ingredientHit.inner_hits['ingredient.option'].hits.hits ) {
                buckets[ optionHit._source.name_suggestable ] = Math.max( optionHit._score, buckets[ optionHit._source.name_suggestable ] || 0 );
            }
        }
    }
    let responseArray = Object.keys(buckets).sort((a,b) => {
        //let maxAHit = a.top.hits.hits
        if( buckets[a] > buckets[b] ) return -1;
        if( buckets[b] > buckets[a] ) return 1;
        return 0;
    }).slice(0, MAX_SUGGESTIONS);
    return Promise.resolve(responseArray);
}

/**
 * Get Allergens by Prefix.
 * To be used to suggest allergens to users.
 * @param {String} search - The prefix to search by.
 * @returns {Promise<Array>} - An array of suggestions ordered by most commonly occuring match. 
 */
async function getAllergensPrefix( search ) {

    if( !errorCheckType(search, "string") ) return Promise.reject(BAD_REQUEST);

    let body = {
        "_source": false,
        "query": {
            "bool": {
                "filter": {
                    "term": {
                        "approved": true
                    }
                },
                "must": [
                    {
                        "nested": {
                            "inner_hits": {"size":ELASTICSEARCH_INNER_HITS_COUNT,"_source":false},
                            "path": "ingredient",
                            "query": {
                                "nested": {
                                    "inner_hits": {"size":ELASTICSEARCH_INNER_HITS_COUNT,"_source":false},
                                    "path": "ingredient.option",
                                    "query": {
                                        "nested": {
                                            "inner_hits": {"size":ELASTICSEARCH_INNER_HITS_COUNT,"_source":"ingredient.option.allergen.name_suggestable"},
                                            "path": "ingredient.option.allergen",
                                            "query": {
                                                "bool": {
                                                    "should": [
                                                        {
                                                            "multi_match": {
                                                                "query": search,
                                                                "type": "bool_prefix",
                                                                "fuzziness": ELASTICSEARCH_FUZZINESS,
                                                                "fields": [
                                                                        "ingredient.option.allergen.name",
                                                                        "ingredient.option.allergen.name._2gram",
                                                                        "ingredient.option.allergen.name._3gram"
                                                                ]
                                                            }
                                                        },
                                                        {
                                                            "match": {
                                                                "ingredient.option.allergen.name": {
                                                                    "query": search,
                                                                    "fuzziness": ELASTICSEARCH_FUZZINESS // The bool prefix query doesn't search for fuzinness on the last item in the list, but we can here
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
    };

    let response = await client.search({
        index: ELASTICSEARCH_INDEX,
        body: body
    });

    let buckets = {}; // keys = name_suggestable, value = max_score
    for( let recipeHit of response.hits.hits ) {
        for( let ingredientHit of recipeHit.inner_hits.ingredient.hits.hits ) {
            for( let optionHit of ingredientHit.inner_hits['ingredient.option'].hits.hits ) {
                for( let allergenHit of optionHit.inner_hits['ingredient.option.allergen'].hits.hits ) {
                    buckets[ allergenHit._source.name_suggestable ] = Math.max( allergenHit._score, buckets[ allergenHit._source.name_suggestable ] || 0 );
                }
            }
        }
    }
    let responseArray = Object.keys(buckets).sort((a,b) => {
        //let maxAHit = a.top.hits.hits
        if( buckets[a] > buckets[b] ) return -1;
        if( buckets[b] > buckets[a] ) return 1;
        return 0;
    }).slice(0, MAX_SUGGESTIONS);
    return Promise.resolve(responseArray);
}

/**
 * Get the allergens for an option. We will use the first option we find that matches the option specfied.
 * We don't need to use suggestable here, because the whole point of that field is to bucketize.
 * Since we only look at one recipe, we aren't going to get different names for the same item such as "egg" and "eggs"
 * @param {String} option - The option to get allergens for.
 * @returns {Promise<Array>} - An array of allergens for the option.
 */
async function getAllergens( option ) {

    if( !errorCheckType(option, "string") ) return Promise.reject(BAD_REQUEST);

    let body = {
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "approved": true
                        }
                    },
                    {
                        "nested": {
                            "inner_hits": {},
                            "path": "ingredient",
                            "query": {
                                "nested": {
                                    "inner_hits": {},
                                    "path": "ingredient.option",
                                    "query": {
                                        "match": {
                                            "ingredient.option.name": option
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
    };

    let response = await client.search({
        index: ELASTICSEARCH_INDEX,
        body: body
    });

    if( response.hits.hits.length ) {
        let val = response.hits.hits[0].inner_hits.ingredient.hits.hits[0].inner_hits['ingredient.option'].hits.hits[0]._source.allergen;
        val = [].concat(val);
        return Promise.resolve( val.map(el => el.name) );
    }

}

/**
 * Generate a slug to have nice ids.
 * @param {string} name - The name of the recipe.
 * @returns {Promise<string>} A unique slug to serve as the ID.
 */
async function generateSlug( name ) {
    let slug = name.toLowerCase().replace(/\s/g,"-").replace(/[^a-z\d-]/g,"");
    let slugBase = slug;
    let count = 1;
    while(true) {
        if( count > 1 ) {
            slug = slugBase + "-" + count;
        }
        let recipes = await getRecipes( slug );
        recipes = recipes.recipes; // ignore hits
        if( recipes.length ) {
            count++;
        }
        else {
            break;
        }
    }
    return Promise.resolve(slug);
}

/**
 * Index a Recipe (create or update).
 * @param {String} [id] - The id of the document if we are doing an update.  
 * @param {String} name - The name of the recipe. 
 * @param {Array<Object>} tag - The tags for the recipe.
 * @param {String} tag.name - The name of the tag.
 * @param {String} steps - The steps to do the recipe. 
 * @param {boolean} approved - True if the recipe has been approved for use.
 * @param {Array<Object>} ingredient - The recipe ingredients.
 * @param {Array} ingredient.option - The options for this ingredient (aka typical ingredient and substitutes).
 * @param {String} ingredient.option.name - The name of the option
 * @param {String} ingredient.option.quantity - How much of the ingredient to use.
 * @param {Array<Object>} ingredient.option.allergen - The allergens in the option.
 * @param {String} ingredient.option.allergen.name - The name of the allergen.
 * @param {Object} [credit] - Credit for the recipe.
 * @param {String} [credit.name] - The name of the person who made the recipe.
 * @param {String} [credit.link] - The link or email of the person who made the recipe.
 * @returns {Promise<String>} - A promise containing the newly id of the newly creted document.
 */
async function indexRecipe( id, name, tag, steps, approved, ingredient, credit ) {

    // error check
    if( 
        (id && !errorCheckType( id, "string" )) ||
        !name ||
        !errorCheckType( name, "string" ) ||
        !errorCheckType( tag, "array" ) ||
        !errorCheckType( steps, "string" ) ||
        !errorCheckType( approved, "boolean" ) ||
        !errorCheckType( ingredient, "array" ) ||
        (credit && (!errorCheckType( credit, "object") 
            || !errorCheckType( credit.name, "string" )
            || (credit.link && !errorCheckType( credit.link, "string" ))))
    ) {
        return Promise.reject(BAD_REQUEST);
    }
    for( let t of tag ) {
        if( !errorCheckType(t, "object") ) return Promise.reject(BAD_REQUEST);
        if( !errorCheckType(t.name, "string") ) return Promise.reject(BAD_REQUEST);
    }
    for( let i of ingredient ) {
        if( !errorCheckType(i, "object") ) return Promise.reject(BAD_REQUEST); // ingredient is not an object
        let keys = Object.keys(i);
        if( keys.length != 1 || !i["option"] ) return Promise.reject(BAD_REQUEST); // incorrect keys for ingredient
        if( !errorCheckType(i.option, "array") ) return Promise.reject(BAD_REQUEST); // incorrect type for option
        for( let o of i.option ) {
            if( !errorCheckType(o, "object") ) return Promise.reject(BAD_REQUEST); // option is not an object
            keys = Object.keys(o);
            if( keys.length != 3 || !o["name"] || !o["quantity"] || !o["allergen"] ) return Promise.reject(BAD_REQUEST); // incorrect keys for ingredient
            if( !errorCheckType(o.name, "string") ) return Promise.reject(BAD_REQUEST); // incorrect type for quantity
            if( !errorCheckType(o.quantity, "string") ) return Promise.reject(BAD_REQUEST); // incorrect type for name
            if( !errorCheckType(o.allergen, "array") ) return Promise.reject(BAD_REQUEST); // incorrect type for name
            for( let a of o.allergen ) {
                if( !errorCheckType(a, "object") ) return Promise.reject(BAD_REQUEST); // allergen is not an object
                keys = Object.keys(a);
                if( keys.length != 1 || !a[name] );
                if( !errorCheckType(a.name, "string") ) return Promise.reject(BAD_REQUEST); // incorrect type for name
            }
        }

    }

    id = striptags(id);
    name = striptags(name).trim();
    if( !id ) {
        id = await generateSlug(name);
    }
    if( credit ) {
        if( credit.name ) credit.name = striptags(credit.name).trim();
        if( credit.link ) credit.link = striptags(credit.link).trim();
    }

    steps = sanitizeHtml(steps, {
        allowedTags: ["ul","ol","li","p","pre","blockquote","div","span","br","sub","em","strong","sup","code","h1", "h2","h3","h4","h5","h6","img"],
        allowedAttributes: {
            img: ['src','width','height']
        }
    });
    let testSteps = parse( `<div>${steps}</div>` );
    let images = testSteps.querySelectorAll("img");
    let s3Regex = new RegExp("^https://s3\\.amazonaws\\.com/"+AWS_S3_BUCKET+"/.*\\.(png|jpg|jpeg|gif)","ig");
    let s3Regex2 = new RegExp("^https://"+AWS_S3_BUCKET+"\\.s3\\.amazonaws\\.com/.*\\.(png|jpg|jpeg|gif)","ig");
    for( let image of images ) {
        if( !image.getAttribute("src").match(s3Regex) && !image.getAttribute("src").match(s3Regex2) ) {
            return Promise.reject(BAD_REQUEST);
        }
    }

    // We set all tags, options, and allergens to lowercase. We do not want duplicates that simply differ by case both for searching (which we could do in the mapping), but also when displayed to the user.
    // We do allow case sensitivity in recipe names however.
    // Additionally, we remove plurality as we likewise don't want plural and non-plural duplicates being suggested to users.
    // We could use the analyze API with elasticseach, but doing it locally prevents the external request.
    for( let t of tag ) {
        t.name = striptags(pluralize.singular(t.name.toLowerCase())).trim(); // tags, we actually do want singular and lower for display not just when suggestable
    }
    for( let i of ingredient ) {
        for( let o of i.option ) {
            o.name = striptags(o.name).trim();
            o.quantity = striptags(o.quantity).trim();
            o.name_suggestable = pluralize.singular(o.name.toLowerCase()).trim();
            for( let a of o.allergen ) {
                a.name = striptags(a.name).trim();
                a.name_suggestable = pluralize.singular(a.name.toLowerCase()).trim();
            }
        }
    }

    let body = {
        name: name,
        tag: tag,
        steps: steps,
        approved: approved,
        ingredient: ingredient
    };
    if( credit ) body.credit = credit;

    let response = await client.index({
        index: ELASTICSEARCH_INDEX,
        id: id,
        body: body
    });

    return Promise.resolve(response._id);
}

/**
 * Delete a recipe.
 * @param {Sting} id - The id of the recipe to delete.
 * @returns {Promise<string>} - A promise contianing the result of the operation.
 */
async function deleteRecipe( id ) {

    if( !errorCheckType(id, "string") ) return Promise.reject(BAD_REQUEST);

    let response = await client.delete({
        index: ELASTICSEARCH_INDEX,
        id: id
    });

    return Promise.resolve(response.result);
}

/**
 * Login the the administration section.
 * @param {String} username - The attempted username. 
 * @param {String} password - The attempted password.
 * @returns {String} - The token to set as a cookie or null if the login failed.
 */
function login( username, password ) {

    if( username == process.env.ADMIN_USERNAME && crypto.createHash("md5").update(password).digest("hex") == process.env.ADMIN_PASSWORD ) {
        let token = jwt.sign( {"username": username}, process.env.TOKEN_KEY, TOKEN_OPTIONS );
        return token;
    }

    return null;

}

/**
 * Determine if a token is valid to count as logged in.
 * @param {String} token - The token for the user.
 * @returns {boolean} - True if we are logged in, false if not.
 */
function isLoggedIn( token ) {

    try {
        let result = jwt.verify( token, process.env.TOKEN_KEY, TOKEN_OPTIONS );
        if( result.username == process.env.ADMIN_USERNAME ) return true;
        return false;
    }
    catch(err) {
        // Invalid token
        return false;
    }

}

/**
 * Determine if a value is of a given type.
 * @param {*} value - The value to check. 
 * @param {string} type - The type the value should be. 
 */
function errorCheckType( value, type ) {
    if( type == "string" || type == "number" || type == "boolean" ) {
        return typeof value == type;
    }
    else if( type == "array" ) {
        return typeof value == "object" && Array.isArray(value);
    }
    else if( type == "object" ) {
        return typeof value == type && !Array.isArray(value);
    }
}