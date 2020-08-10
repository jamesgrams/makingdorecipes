import React from 'react';
import Helmet from 'react-helmet'

class Instructions extends React.Component {

    /**
     * Constructor.
     * @param {Array} props - The props to pass in on initialization.
     */
    constructor(props) {
        super(props);

        this.state = {};
    }

    /**
     * Render the element.
     */
    render() {

        let metaTitle = "Instructions - Making Do Recipes";
        let metaDescription = "Making Do Recipes Instructions.";

        return <div className="Instructions">
            <Helmet>
                <title>{metaTitle}</title>
                <meta name="description" content={metaDescription} />
                <meta property="og:title" content={metaTitle}/>
                <meta property="og:url" content="https://makingdorecipes.com/instructions"/>
                <meta propery="og:description" content={metaDescription}/>
                <meta property="twitter:title" content={metaTitle}/>
                <meta propery="twitter:description" content={metaDescription}/>
            </Helmet>
            Use the search bar to find particular recipes.  Filter your search by inputting a list of each of your allergens into the search tool.  In the case of more restricted diets, instead of inputting your allergens, input each "safe" food into the search tool, or at least the safe foods that you think are pertinent to the type of recipe you hope to find (ie. If chicken is safe, but you are searching for desserts, you may wish to skip listing it).  For more advanced search features, press "show more."  You can type in a tag - such as "dinner," "baked good," or "seasoning" - to further filter the recipes that are returned.  Also, if you’re willing to find recipes where you may need to figure out a substitute for one or more ingredients, change the number in the "flexibility" field.<br/><br/>You can submit your own recipes too!  Simply press the plus sign at the bottom right hand side of the page.  Give a name to your recipe and add as few or as many tags as you deem necessary.  List each ingredient and its corresponding allergens.  Make sure to press the enter key after typing in each allergen.  If you know of any good substitutions for certain ingredients, please press "add substitute" for those ingredients.  Then, write the instructions for your recipe.  If it is a recipe found on another website, make sure to credit the recipe’s created by linking to the original page at the end of the instructions.  You also have the option of either submitting your name and website/email, or submitting it anonymously.  Now, let’s get cooking!
        </div>
    }
}

export default Instructions;