/**
 * Endpoints for interacting with the Elasticsearch backend of Making Do Recipes.
 * @author  James Grams
 */

/******************************************* Constants *********************************************/

const express = require('express');
const elasticsearch = require("elasticsearch");
const jwt = require('jsonwebtoken');
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const pluralize = require("pluralize");
const striptags = require("striptags");

const PORT=process.env.PORT || 80;
const ELASTICSEARCH_INDEX = "recipe";
const ELASTICSEARCH_FUZZINESS = "AUTO";
const HTTP_OK = 200;
const HTTP_SEMANTIC_ERROR = 422;
const HTTP_UNAUTHORIZED = 401;
const SUCCESS = "success";
const FAILURE = "failure";
const TOKEN_COOKIE = "making-do-recipes-token";
const TOKEN_OPTIONS = {"expiresIn": "2d"};
const TOKEN_EXPIRES_IN_MS = 172800000;
const BAD_REQUEST = "Bad Request";

/****************** Setup connection to Elasticsearch and start the Express app. ******************/

const client = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH_HOST,
    apiVersion: '7.2'
});
const app = express();
app.use( express.json() );
app.use(cookieParser());
app.use("/", express.static("assets/build"));

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
        let recipes = await getRecipes(request.query.id, request.query.search, request.query.tags ? request.query.tags.split(",") : null, request.query.safes ? request.query.safes.split(",") : null, request.query.allergens ? request.query.allergens.split(",") : null, request.query.flexibility ? parseInt(request.query.flexibility) : 0, request.query.prefix ? true : false, request.query.unapproved ? true : false, request.query.all ? true : false);
        writeResponse(response, SUCCESS, {"recipes":recipes});
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
 * @returns {Promise<Array>} - A promise containing an array of all the response objects.
 */
async function getRecipes( id, search, tags, safes, allergens, flexibility=0, prefix=false, unapproved=false, all=false ) {

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
                    ]
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
                            "match": {"tag.name": tag} }
                        }
                    }
                })
            }
        });
    }
    // safes and allergens
    if( safes || allergens ) {
        let mustSection = {};
        let mustArray = [];
        let iterateArray;
        if( safes ) {
            mustSection["must_not"] = mustArray;
            iterateArray = safes;
        }
        else {
            mustSection["should"] = mustArray;
            iterateArray = allergens;
        }
        for( let item of iterateArray ) {
            mustArray.push({
                "match": {"ingredient.option.allergen.name": item}
            });
        }

        // See test.json for an explanation of what is going on here.
        let allergensSection = {
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
                                                                            "bool": mustSection
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

        searchParts.push(allergensSection);
    }
    
    let body = {
        "query": {
            "bool": {
                "must": searchParts
            }
        }
    };

    let response = await client.search({
        index: ELASTICSEARCH_INDEX,
        body: body
    });

    
    let responseVal = [];
    if( response.hits.hits.length ) {
        responseVal = response.hits.hits.map( el => { return{...el._source, "id":el._id} } );
    }

    return Promise.resolve(responseVal);
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
                    "path": "ingredient"
                },
                "aggs": {
                    "ingredients": {
                        "nested": {
                            "path": "ingredient.option"
                        },
                        "aggs": {
                            "options": {
                                "filter": {
                                    "multi_match": {
                                        "query": search,
                                        "type": "bool_prefix",
                                        "fields": [
                                                "ingredient.option.name",
                                                "ingredient.option.name._2gram",
                                                "ingredient.option.name._3gram"
                                        ]
                                    }
                                },
                                "aggs": {
                                    "options_filtered": {
                                        "terms": {
                                            "field": "ingredient.option.name_suggestable"
                                        }
                                    }
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

    return Promise.resolve(response.aggregations.recipes.ingredients.options.options_filtered.buckets.map(el => el.key));
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
                    "path": "ingredient"
                },
                "aggs": {
                    "ingredients": {
                        "nested": {
                            "path": "ingredient.option"
                        },
                        "aggs": {
                            "options": {
                                "nested": {
                                    "path": "ingredient.option.allergen"
                                },
                                "aggs": {
                                    "allergens": {
                                        "filter": {
                                            "multi_match": {
                                                "query": search,
                                                "type": "bool_prefix",
                                                "fields": [
                                                        "ingredient.option.allergen.name",
                                                        "ingredient.option.allergen.name._2gram",
                                                        "ingredient.option.allergen.name._3gram"
                                                ]
                                            }
                                        },
                                        "aggs": {
                                            "allergens_filtered": {
                                                "terms": {
                                                    "field": "ingredient.option.allergen.name_suggestable"
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
    };

    let response = await client.search({
        index: ELASTICSEARCH_INDEX,
        body: body
    });

    return Promise.resolve(response.aggregations.recipes.ingredients.options.allergens.allergens_filtered.buckets.map(el => el.key));
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
    name = striptags(name);
    if( !id ) {
        id = await generateSlug(name);
    }
    if( credit ) {
        if( credit.name ) credit.name = striptags(credit.name);
        if( credit.link ) credit.link = striptags(credit.link);
    }
    steps = striptags( steps, ["ul","ol","li","p","pre","blockquote","div","span","br","sub","em","strong","sup","code","h1", "h2","h3","h4","h5","h6"] );
    // We set all tags, options, and allergens to lowercase. We do not want duplicates that simply differ by case both for searching (which we could do in the mapping), but also when displayed to the user.
    // We do allow case sensitivity in recipe names however.
    // Additionally, we remove plurality as we likewise don't want plural and non-plural duplicates being suggested to users.
    // We could use the analyze API with elasticseach, but doing it locally prevents the external request.
    for( let t of tag ) {
        t.name = striptags(pluralize.singular(t.name.toLowerCase())); // tags, we actually do want singular and lower for display not just when suggestable
    }
    for( let i of ingredient ) {
        for( let o of i.option ) {
            o.name = striptags(o.name);
            o.quantity = striptags(o.quantity);
            o.name_suggestable = pluralize.singular(o.name.toLowerCase());
            for( let a of o.allergen ) {
                a.name = striptags(a.name);
                a.name_suggestable = pluralize.singular(a.name.toLowerCase());
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