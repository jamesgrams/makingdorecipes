import React from 'react';
import Helmet from 'react-helmet'
import './About.css';

class About extends React.Component {

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

        let metaTitle = "About - Making Do Recipes";
        let metaDescription = "Making Do Recipes aims to help people with restrictive allergies including FPIES, MCAS, and EoE to find recipes. Come hear our story.";

        return <div className="About">
            <Helmet>
                <title>{metaTitle}</title>
                <meta name="description" content={metaDescription} />
                <meta property="og:title" content={metaTitle}/>
                <meta property="og:url" content="https://makingdorecipes.com/about"/>
                <meta propery="og:description" content={metaDescription}/>
                <meta property="twitter:title" content={metaTitle}/>
                <meta propery="twitter:description" content={metaDescription}/>
            </Helmet>
            <img alt="The Grams Family" src="/family.jpg"/>
            Hello. Our names are James and Kasey Grams, the creators and operators of Making Do Recipes. We are a young couple living in North Carolina with our son, Elisha, who was born in March 2019.  Kasey has Celiac disease and EIA to wheat, which require a strict avoidance of gluten-containing foods, so reading allergen menus and checking ingredient lists were already a regular part our life together when we got married.<br/><br/>However, soon after Eli was born, new food allergies were added to the equation, leading to more dietary restrictions.  He was diagnosed with MSPI in July 2019 and FPIES a few months later.  Eli is allergic to dairy, soy, eggs, peanuts, peas, corn, oats, sunflower, and beef. As a breastfeeding mother, this meant that Kasey’s diet had to be restricted as well as Eli’s as he started on his journey of eating solid food. From this predicament, the idea for Making Do Recipes sprouted.<br/><br/>We wanted to create a way for people with food allergies and other dietary restrictions to easily find recipes that they can enjoy. While other websites may allow you find recipes without certain allergens, oftentimes the lists of allergens to choose from are not comprehensive. Likewise, we noticed that there was no way to search by safe foods, which is incredibly important for families when introducing new foods to children diagnosed with FPIES, MCAS, or EoE.  With Making Do Recipes, recipes are submitted and reviewed with allergens listed for each ingredient and are not limited to a pre-defined list, such as the "top 8" or "top 13."  This makes it easy to search for recipes at the level of specificity required for people with multiple allergies or dietary restrictions and even allows you to search for recipes that have a certain number of ingredients that you can't have if you want to try out your own substitutes. Thanks for visiting!  We hope this website allows you to make do with the foods that you CAN eat!<br/><br/>For more of our work, check out <a href="https://jamesgrams.com" target="_blank" rel="noopener">jamesgrams.com</a>.
        </div>
    }
}

export default About;
