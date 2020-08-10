import React from 'react';
import Helmet from 'react-helmet'

class Disclaimer extends React.Component {

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

        let metaTitle = "Disclaimer - Making Do Recipes";
        let metaDescription = "Making Do Recipes Disclaimer.";

        return <div className="Disclaimer">
            <Helmet>
                <title>{metaTitle}</title>
                <meta name="description" content={metaDescription} />
                <meta property="og:title" content={metaTitle}/>
                <meta property="og:url" content="https://makingdorecipes.com/disclaimer"/>
                <meta propery="og:description" content={metaDescription}/>
                <meta property="twitter:title" content={metaTitle}/>
                <meta propery="twitter:description" content={metaDescription}/>
            </Helmet>
            While we try our best to make sure the allergens listed per ingredient are accurate, we ask that you double-check to make sure ingredients are safe before using them. Making Do Recipes does not bear any responsibility if you or any ingredient consumer ingests an ingredient that you or the ingredient consumer is allergic to, even if Making Do Recipes does not indicate that the ingredient contains one of your or the ingredient consumer's allergens. That being said, if you believe an allergen that should be listed is not listed for a particular ingredient, please don't hesitate to <a href='mailto:admin@makingdorecipes.com'>contact us</a> as this helps us to improve what we offer to all our visitors.
        </div>
    }
}

export default Disclaimer;