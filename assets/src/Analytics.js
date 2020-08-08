import {
    useHistory
} from "react-router-dom";
import ReactGA from 'react-ga';
ReactGA.initialize(process.env.REACT_APP_GA_TRACKER);

const Analytics = () => {
    const history = useHistory();

    let sendTimeout = null;
    
    // The timeout exists so we can call replaceState quickly and not send the url of before and after
    let send = (location) => {
        if( history.action === "REPLACE" ) {
            clearTimeout(sendTimeout);
        }
        sendTimeout = setTimeout( () => {
            ReactGA.pageview(history.location.pathname + history.location.search);
        }, 10);
    };
    
    send();
    history.listen( send );
    return null;
}

export default Analytics;
