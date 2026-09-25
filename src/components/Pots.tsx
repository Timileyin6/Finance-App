import React from "react";
import '../css/pots.css';
import '../css/glow.css';

function PotBar({pot}){
    return(
        <div className="container" >
                             <span className="funky"></span>
                                <div className="potset">
                                    <p className="grey">{pot.name}</p>
                                    <p className="funds bills">${pot.value}</p>
                                </div>                                
        </div>
    )
}

export default PotBar;