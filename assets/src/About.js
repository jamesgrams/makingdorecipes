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
        let metaDescription = "Making Do Recipes aims to help people with restrictive allergies find recipes. Come hear our story.";

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
            Hello, our names are James and Kasey Grams, and we run Making Do Recipes. We are a young couple living in North Carolina with a baby boy, Elisha, born in 2019. Kasey has Celiac disease - meaning she cannot eat gluten. This was all well and good, but soon after Eli was born, he was diagnosed with FPIES. This amplified an already restricted diet to new levels. Eli is allergic to corn, sunflower, eggs, peas, beef, dairy, soy, and peanuts. As a breastfeeding mom, this meant Kasey's diet was also restricted. From this predicament, the idea for Making Do Recipes sprouted.<br/><br/>We wanted to create a way for people with allergies to easily find recipes that they can enjoy. While other websites would let you find recipes without certain allergens, oftentimes the lists of allergens to choose from were not comprehensive. Likewise, there was no way to search by safe foods - something that Kasey needed to do alot before all of Eli's allergies were pinpointed. With Making Do Recipes, recipes are submitted and reviewed with allergens listed at a per ingredient level and are not limited to a pre-defined list. This makes it easy to search for recipes at the level of specificity required for people with lots of allergies and even allows you to search for recipes that have a certain number of ingredients that you can't have if you want to try your own substitutes. Thanks for visiting!
        </div>
    }
}

export default About;