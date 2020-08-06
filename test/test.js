const axios = require("axios");
const fs = require("fs");
const elasticsearch = require("elasticsearch");

// Be sure to set the ELASTICSEARCH_HOST, TEST_USERNAME, and TEST_PASSWORD environment variables before running.

const cookieDoc = {
    "name": "Cookies",
    "tag": [{"name": "dessert"},{"name":"snack"}],
    "approved": false,
    "credit": {
        "name": "James Grams",
        "link": "https://game103.net"
    },
    "steps": "Bake in the oven",
    "ingredient": [
        {
            "option": [
                {
                    "name": "Chocolate Milk",
                    "quantity": "1 Cup",
                    "allergen": [
                        {"name": "Milk"},
                        {"name": "Cocoa"}
                    ]
                },
                {
                    "name": "Coconut Chocolate Milk",
                    "quantity": "1 Cup",
                    "allergen": [
                        {"name": "Coconut"},
                        {"name": "Cocoa"}
                    ]
                }
            ]
        },
        {
            "option": [{
                "name": "Eggs",
                "quantity": "2",
                "allergen": [{"name":"Eggs"}]
            }]
        }
    ]
};
const cakeDoc = {
    "name": "Cake",
    "tag": [{"name":"dessert"},{"name":"tea"}],
    "credit": {
        "name": "Kasey Grams"
    },
    "approved": false,
    "steps": "Mix in the bowl",
    "ingredient": [
        {
            "option": [{
                "name": "Milk",
                "quantity": "2 Pints",
                "allergen": [{"name":"Milk"}]
            }]
        }
    ]
};
const iceCreamDoc = {
    "name": "Ice Cream",
    "tag": [{"name":"dessert"}],
    "approved": false,
    "steps": "Put in the freezer",
    "ingredient": [
        {
            "option": [
                {
                    "name": "Chocolate Milk",
                    "quantity": "1 Cup",
                    "allergen": [
                        {"name": "Milk"},
                        {"name": "Cocoa"}
                    ]
                },
                {
                    "name": "Coconut Chocolate Milk",
                    "quantity": "1 Cup",
                    "allergen": [
                        {"name": "Coconut"},
                        {"name": "Cocoa"}
                    ]
                }
            ]
        }
    ]
};
const coconutDoc = {
    "name": "Coconut",
    "tag": [{"name":"snack"},{"name":"fruit"}],
    "approved": false,
    "steps": "It's already made!",
    "ingredient": [
        {
            "option": [{
                "name": "Coconut",
                "quantity": "2",
                "allergen": [{"name":"Coconut"}]
            }]
        }
    ]
};

/**
 * Rune the tests.
 */
async function runTests() {

    // Clear out any current items in the database.
    await deleteAll();

    // Index recipes
    let cookieId = await axios.put( "/recipe", cookieDoc );
    await sleep(1000);
    let cakeId = await axios.put( "/recipe", cakeDoc );
    await sleep(1000);
    let iceCreamId = await axios.put( "/recipe", iceCreamDoc );
    await sleep(1000);
    let coconutId = await axios.put( "/recipe", coconutDoc );
    await sleep(1000);
    cookieId = cookieId.data.id;
    cakeId = cakeId.data.id;
    iceCreamId = iceCreamId.data.id;
    coconutId = coconutId.data.id;
    console.log( "Cookie: " + cookieId );
    console.log( "Cake: " + cakeId );
    console.log( "Ice Cream: " + iceCreamId );
    console.log( "Coconut: " + coconutId );
    cookieDoc.id = cookieId;
    cakeDoc.id = cakeId;
    coconutDoc.id = coconutId;
    iceCreamDoc.id = iceCreamId;

    // These should fail due to not being logged in
    // Update recipes
    try {
        cookieDoc.approved = true;
        await axios.put( "/recipe", cookieDoc );
    }
    catch(err) {
        console.log("Blocked unauthorized request to set recipe to approved");
    }
    // Delete Recipes
    try {
        await axios.delete( "/recipe?id=" + cookieId );
    }
    catch(err) {
        console.log("Blocked unauthorized request to delete recipe");
    }
    // Get unapproved recipes
    try {
        await axios.get( "/recipe?unapproved=true" );
    }
    catch(err) {
        console.log("Blocked unauthorized request to get unapproved recipes");
    }
    // Get all recipes
    try {
        await axios.get( "/recipe?all=true" );
    }
    catch(err) {
        console.log("Blocked unauthorized request to get all recipes");
    }

    // Try all our public methods - they should all return nothing, because we don't have any approved records.
    await matchSearch("Null Search Test", "/recipe", (result) => result.data.recipes.length == 0 );
    await matchSearch("Null Options Prefix Test", "/option?search=c", (result) => result.data.options.length == 0 );
    await matchSearch("Null Allegens Prefix Test", "/allergen?search=c", (result) => result.data.allergens.length == 0 );
    await matchSearch("Null Allergen for Option Test", "/option-allergen?option=Chocolate Milk", (result) => !result.data.allergens || result.data.allergens.length == 0 );

    let loginResult = await axios.post("/login", {
        "username": process.env.TEST_USERNAME,
        "password": process.env.TEST_PASSWORD
    });
    let cookie = loginResult.headers["set-cookie"][0];
    // Now try to update and delete after we have a login cookie
    iceCreamDoc.approved = true;
    cakeDoc.approved = true;
    coconutDoc.approved = true;
    await axios.request({"method":"put", "url":"/recipe", "data":cookieDoc, "headers": {"Cookie": cookie}});
    await sleep(1000);
    await axios.request({"method":"put", "url":"/recipe", "data":iceCreamDoc, "headers": {"Cookie": cookie}});
    await sleep(1000);
    await axios.request({"method":"put", "url":"/recipe", "data":cakeDoc, "headers": {"Cookie": cookie}});
    // re-add coconut
    delete coconutDoc["id"];
    await sleep(1000);
    await axios.request({"method":"delete", "url":"/recipe?id=" + coconutId, "headers": {"Cookie": cookie}});
    coconutId = await axios.request({"method":"put", "url":"/recipe", "data":coconutDoc, "headers": {"Cookie": cookie}});
    coconutId = coconutId.data.id;
    console.log( "Coconut: " + coconutId );
    // unapproved recipes - should not throw an error
    await sleep(1000);
    await axios.request({"method":"get", "url":"/recipe?unapproved=true", "headers": {"Cookie": cookie}});

    // Get recipes
    await sleep(1000);
    await matchSearch("Search Test", "/recipe?search=ice", (result) => result.data.recipes.length == 1 && result.data.recipes[0].name == "Ice Cream" );
    await matchSearch("Search Fuzzy Test", "/recipe?search=Cocoanut", (result) => result.data.recipes.length == 1 && result.data.recipes[0].name == "Coconut" );
    // full option match for cookies, but no eggs
    await matchSearch("Safes Test", "/recipe?safes=milk,cocoa", (result) => result.data.recipes.length == 2 && result.data.recipes.filter(el => el.name=="Ice Cream").length && result.data.recipes.filter(el => el.name=="Cake").length );
    // no milk, but when choco milk is the ingredient, we can use the coconut milk option - should be 3 results all except cake
    await matchSearch("Safes Test 2", "/recipe?safes=eggs,coconut,cocoa", (result) => result.data.recipes.length == 3 && result.data.recipes.filter(el => el.name=="Ice Cream").length && result.data.recipes.filter(el => el.name=="Coconut").length && result.data.recipes.filter(el => el.name=="Cookies").length);
    // eggs, but not enough for choco milk - only cake is the response
    await matchSearch("Safes Test 3", "/recipe?safes=milk,eggs", (result) => result.data.recipes.length == 1 && result.data.recipes[0].name == "Cake");
    // cocoa - enough for one of the options in the choco milk items, but not both
    await matchSearch("Safes Test 4", "/recipe?safes=cocoa,eggs", (result) => result.data.recipes.length == 0);
    // plural/singular safes test
    await matchSearch("Safes Plural Test", "/recipe?safes=egg,coconuts,cocoa", (result) => result.data.recipes.length == 3 && result.data.recipes.filter(el => el.name=="Ice Cream").length && result.data.recipes.filter(el => el.name=="Coconut").length && result.data.recipes.filter(el => el.name=="Cookies").length);
    // milk with flexibility one - should match all but cookies - only cake will pass with 0 problems
    await matchSearch("Safes Flexibility Test", "/recipe?safes=milk&flexibility=1", (result) => result.data.recipes.length == 3 && !result.data.recipes.filter(el => el.name=="Cookies").length );
    // allergens test - we should get the substitutes of coconut for ice cream and cookies
    await matchSearch("Allergens Test", "/recipe?allergens=milk", (result) => result.data.recipes.length == 3 && !result.data.recipes.filter(el => el.name=="Cake").length );
    // should just be coconut
    await matchSearch("Allergens Test 2", "/recipe?allergens=milk,cocoa", (result) => result.data.recipes.length == 1 && result.data.recipes[0].name == "Coconut" );
    // should just be coconut and cake
    await matchSearch("Allergens Test 3", "/recipe?allergens=cocoa", (result) => result.data.recipes.length == 2 && result.data.recipes.filter(el => el.name=="Coconut").length && result.data.recipes.filter(el => el.name=="Cake").length );
    // allergens flexibility test - we should get the flex to allow ice cream, but not cookies (cookies will have two bad ingredients)
    await matchSearch("Allergens Flexibility Test", "/recipe?allergens=cocoa,eggs&flexibility=1", (result) => result.data.recipes.length == 3 && !result.data.recipes.filter(el => el.name=="Cookies").length );
    // prefix test
    await matchSearch("Prefix Test", "/recipe?search=coc&prefix=true", (result) => result.data.recipes.length == 1 && result.data.recipes[0].name == "Coconut" );
    // prefix plural test
    await matchSearch("Prefix Test", "/recipe?search=coconuts&prefix=true", (result) => result.data.recipes.length == 1 && result.data.recipes[0].name == "Coconut" );
    // tags test
    await matchSearch("Tags Test", "/recipe?tags=fruit", (result) => result.data.recipes.length == 1 && result.data.recipes[0].name == "Coconut" );
    // tags plural
    await matchSearch("Tags Plural Test", "/recipe?tags=tea,snacks", (result) => result.data.recipes.length == 3 && !result.data.recipes.filter(el => el.name=="Ice Cream").length );
    // tags and search prefix test
    await matchSearch("Tags Prefix Test", "/recipe?tags=dessert&search=co&prefix=true", (result) => result.data.recipes.length == 1 && result.data.recipes.filter(el => el.name=="Cookies").length );
    // safes search test - also capital letter here on search.
    await matchSearch("Search Safes Test", "/recipe?safes=milk&search=Coconut", (result) => result.data.recipes.length == 0 );
    
    // Prefix searches
    await matchSearch("Get Tag Prefix Test", "/tag?search=d", (result) => result.data.tags.length == 1 && JSON.stringify(result.data.tags) == JSON.stringify(["dessert"]) );
    // Order is important here
    await matchSearch("Option Prefix Test", "/option?search=c", (result) => result.data.options.length == 3 && JSON.stringify(result.data.options) == JSON.stringify(["chocolate milk","coconut chocolate milk","coconut"]) );
    // Capital
    await matchSearch("Option Prefix Test Capital", "/option?search=C", (result) => result.data.options.length == 3 && JSON.stringify(result.data.options) == JSON.stringify(["chocolate milk","coconut chocolate milk","coconut"]) );
    await matchSearch("Option Prefix Plural Test", "/option?search=chocolAtes", (result) => result.data.options.length == 2 && JSON.stringify(result.data.options) == JSON.stringify(["chocolate milk","coconut chocolate milk"]) );
    await matchSearch("Allegen Prefix Test", "/allergen?search=cO", (result) => result.data.allergens.length == 2 && JSON.stringify(result.data.allergens) == JSON.stringify(["cocoa","coconut"]) );
    await matchSearch("Allegen Prefix Plural Test", "/allergen?search=coconuts", (result) => result.data.allergens.length == 1 && JSON.stringify(result.data.allergens) == JSON.stringify(["coconut"]) );

    // Allergens for Option test - includes plural
    await matchSearch("Allergen for Option Test", "/option-allergen?option=Chocolate Milks", (result) => result.data.allergens.length == 2 && result.data.allergens.indexOf("Milk") != -1 && result.data.allergens.indexOf("Cocoa") != -1);

    // Bad tests
    let badDoc = {
        "test": "hi"
    };
    let badDoc2 = {};
    let badDoc3 = {
        "name": "Ice Cream",
        "tag": [{"name":"dessert"}],
        "approved": false,
        "ingredient": [
            {
                "option": [
                    {
                        "name": "Chocolate Milk",
                        "quantity": "1 Cup",
                        "allergen": [
                            {"name": "Milk"},
                            {"name": "Cocoa"}
                        ]
                    },
                    {
                        "name": "Coconut Chocolate Milk",
                        "quantity": "1 Cup",
                        "allergen": [
                            {"name": "Coconut"},
                            {"name": "Cocoa"}
                        ]
                    }
                ]
            }
        ]
    };
    let badDoc4 = {
        "name": "Ice Cream",
        "tag": [{"name":"dessert"}],
        "approved": false,
        "steps": "Put in the freezer",
        "ingredient": [
            {
                "option": [
                    {
                        "name": "Chocolate Milk",
                        "quantity": "1 Cup",
                        "allergen": [
                            {"name": "Milk"},
                            {"name": "Cocoa"}
                        ]
                    },
                    {
                        "name": "Coconut Chocolate Milk",
                        "quantity": "1 Cup",
                        "allergen": [
                            {"name": "Coconut"},
                            {"pane": "Cocoa"}
                        ]
                    }
                ]
            }
        ]
    };
    let badDoc5 = {
        "name": "Coconut",
        "tag": [{"name":"snack"},"fruit"],
        "approved": false,
        "steps": "It's already made!",
        "ingredient": [
            {
                "option": [{
                    "quantity": "2",
                    "allergen": [{"name":"Coconut"}]
                }]
            }
        ]
    };
    let badDoc6 = {
        "name": "Coconut",
        "tag": [{"name":"snack"},{"name":"fruit"}],
        "approved": false,
        "steps": "It's already made!",
        "ingredient": 5
    };
    let badDoc7 = {
        "name": "Coconut",
        "credit": "hello",
        "tag": [{"name":"snack"},{"name":"fruit"}],
        "approved": false,
        "steps": "It's already made!",
        "ingredient": []
    };
    await sleep(1000);
    try { await axios.request({"method":"put", "url":"/recipe", "data":badDoc, "headers": {"Cookie": cookie}}); }
    catch(err) { console.log("Bad Doc 1 Rejected"); }
    await sleep(1000);
    try { await axios.request({"method":"put", "url":"/recipe", "data":badDoc2, "headers": {"Cookie": cookie}}); }
    catch(err) { console.log("Bad Doc 2 Rejected"); }
    await sleep(1000);
    try { await axios.request({"method":"put", "url":"/recipe", "data":badDoc3, "headers": {"Cookie": cookie}}); }
    catch(err) { console.log("Bad Doc 3 Rejected"); }
    await sleep(1000);
    try { await axios.request({"method":"put", "url":"/recipe", "data":badDoc4, "headers": {"Cookie": cookie}}); }
    catch(err) { console.log("Bad Doc 4 Rejected"); }
    await sleep(1000);
    try { await axios.request({"method":"put", "url":"/recipe", "data":badDoc5, "headers": {"Cookie": cookie}}); }
    catch(err) { console.log("Bad Doc 5 Rejected"); }
    await sleep(1000);
    try { await axios.request({"method":"put", "url":"/recipe", "data":badDoc6, "headers": {"Cookie": cookie}}); }
    catch(err) { console.log("Bad Doc 6 Rejected"); }
    await sleep(1000);
    try { await axios.request({"method":"put", "url":"/recipe", "data":badDoc7, "headers": {"Cookie": cookie}}); }
    catch(err) { console.log("Bad Doc 7 Rejected"); }
}

/**
 * Match search results.
 * @param {string} name - The name of the test.
 * @param {string} url - The url to search for. 
 * @param {function} expected - A function that takes the actual results as a parameter and returns true if they are expected. 
 */
async function matchSearch( name, url, expected ) {
    await sleep(1000);
    let result = await axios.get(url);
    let testResult = expected(result) ? true : false;
    console.log( (testResult ? "\x1b[32m" : "\x1b[31m") + name + ": " + testResult + "\x1b[37m");
}

/**
 * Delete all the records.
 */
async function deleteAll() {
    const client = new elasticsearch.Client({
        host: process.env.ELASTICSEARCH_HOST,
        apiVersion: '7.2'
    });
    await client.deleteByQuery({
        index: 'recipe',
        body: {
            query: {
                match_all: {}
            }
        }
    });
    return Promise.resolve();
}

/**
 * Sleep
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise} - A promise that returns once the sleep is finished.
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}   

runTests();