import React from 'react';
import Helmet from 'react-helmet'

class Tips extends React.Component {

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

        let metaTitle = "Tips - Making Do Recipes";
        let metaDescription = "Making Do Recipes Tips.";

        return <div className="Tips">
            <Helmet>
                <title>{metaTitle}</title>
                <meta name="description" content={metaDescription} />
                <meta property="og:title" content={metaTitle}/>
                <meta property="og:url" content="https://makingdorecipes.com/tips"/>
                <meta propery="og:description" content={metaDescription}/>
                <meta property="twitter:title" content={metaTitle}/>
                <meta propery="twitter:description" content={metaDescription}/>
            </Helmet>
            Substitute when possible.
        </div>
    }
}

export default Tips;