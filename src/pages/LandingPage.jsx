import TransactionBar from "../components/Transaction"
import PieChartComponent from "../components/PieChartComponent"
import React from "react"
import '../css/LandingPage.css'
import RecurringBills from "../components/Recurring"
import MenuBar from "../components/SideBar"
import PotBar from "../components/Pots"
import { useState } from "react"
import BudgetBar from "../components/Budgets"
import { data } from "react-router-dom"

function PageContent() {
    const [closeBar, setCloseBar] = useState(true)

    const toggleSidebar = () => {
        setCloseBar(!closeBar)
    }

    const transaction = [
        {id: 1,name: "Emma Richardson", value: 75.50, date: "19 Aug 2024"},
        {id: 2,name: "Savory Bites Bistro", value: -55.50, date: "19 Aug 2024"},
        {id: 3,name: "Daniel Carter", value: -42.30, date: "18 Aug 2024"},
        {id: 4,name: "Sun Park", value: 120.00, date: "17 Aug 2024"},
        {id: 5,name: "Urban Services Hub", value: -65.00, date: "17 Aug 2024"},
    ];
    const bills = [
        {id: 1, name:"Paid Bills", value:190.00},
        {id: 2, name:"Total Upcoming", value:194.98},
        {id: 3, name:"Due Soon", value:59.98},
    ];
    const pot = [
        {id: 1, name:"Savings ", value:150,},
        {id: 2, name:"Gifts", value:110},
        {id: 3, name:"Concert Tickets", value:40},
        {id: 4, name:"New Laptop", value:10},
    ];
    const budget = [
        {id: 1, name:"Entertainment ", amount:50.00},
        {id: 2, name:"Bills", amount:750.00},
        {id: 3, name:"Personal Care", amount:100.00},
        {id: 4, name:"Dining Out", amount:75.00},
    ];
    return(


        
        <div className="mainContent">

            <section className="topMetrics">

                <div className="amount black">
                    <p className="grey">Current Balance</p>
                    <h2>$30000</h2>
                </div>
                <div className="amount">
                    <p className="grey">Income</p>
                    <h2>$300000</h2>
                </div>
                <div className="amount">
                    <p className="grey">Expenses</p>
                    <h2>$30000</h2>
                </div>
                </section>
                
                <section className="columns">

                    <div className="leftCols">

            <div className="pots section">
                <div className="heads">
                <h3>Pots</h3>
                <p className="seeMore">See Details    &gt;</p>
                </div>

                <div className="bodys">
                <div className="total-saved">
                <i class="fa-solid fa-money-check-dollar dollar"></i>
                <div>
                    <p className="grey">Total Saved</p>
                    <h2>$850</h2>
                    </div>    
                </div>
                <div className="cat">
                {pot.map(pot => <PotBar pot={pot} key={pot.id} />
            )}
                </div>
                </div>
            </div>

            <div className="transactions sections">
                <div className="heads">
                <h3>Transactions</h3>
                <p className="seeMore">View All    &gt;</p>
                </div>

                {transaction.map(transaction => <TransactionBar transaction={transaction} key={transaction.id}/>)}
                 </div>

            </div>

            <div className="rightCols">

            <div className="budgets section">
                <div className="heads">
                <h3>Budgets</h3>
                <p className="seeMore">See Details    &gt;</p>
                </div>
                <div className="budgetBodys">
                <PieChartComponent  className="chart" data={budget}/>
                <section className="budgetCat">
                {budget.map(budget => <BudgetBar budget={budget} key={budget.id}/>)}
                </section>
                </div>
            </div>

            <div className="recurrings sections">
                <div className="heads">
                    <h3>Recurring Bills</h3>
                    <p className="seeMore">See Details    &gt;</p>
                    </div>
                    <div className="bodysRecur">
                    {bills.map(bills => <RecurringBills bills={bills} key={bills.id}/>)}
                 </div>
                 </div>

            </div>

            
                 </section>


        </div>

    )
}

export default PageContent