import React from "react";

function BudgetBar({budget}){  
    return(
        <div className="container">
            <span className="funky"></span>
                    <div className="mini-budget">
                        <p className="grey"> {budget.name} </p>
                        <p className="amounts bills">${budget.amount} </p>
                    </div>
                           </div>
    )
} 

export default BudgetBar;