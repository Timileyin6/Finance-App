import React from "react";
import BudgetBar from "../components/Budgets";
import PieChartComp from "../components/PieChartComponent";
import { useState } from "react";

function BudgetPageContent(){

    const [budgets, setBudgets] = useState([])
    const [editingBudgets, setEditingBudgets] = useState(null)
    
        const createNewBudget=()=>{
            const newBudget = {
                id: Date.now,
                name: `Budget ${budgets.length+1}`,
                categories: [
                    {name: "Food", value: 1000},
                    {name: "Clothing", value: 500}
                ]
            }
            setBudgets([...budgets, newBudget])
            setEditingBudgets(newBudget.id)
        }
    
        const updateBudgetName=(id, newName)=>{
            setBudgets(budgets.map(budget=>
                budget.id===id?
                {...budget, name: newName} :
                budget
            ))
        }
    
        const deleteBudget=(id)=>{
            setBudgets(budgets.filter(budget=> budget.id!==id))
            if (budget.id === editingBudgets){
                setEditingBudgets(null)
            }
        }
    
        const updateCategories=(budgetID, categoryIndex, field, value)=>{
            setBudgets(budgets.categories.map((budget)=>
            {
                if(budget.id===budgetID){
                    const newCategories = [...budget.categories]
                    newCategories[categoryIndex] = {
                        ...newCategories[categoryIndex], 
                        [field] : field === "value" ? parseFloat(value) : value
                    }
                    return {...budget, categories: newCategories}
                }
                return budget
            }
                    ))
        }
    
        const addNewCategory=(budgetID)=>{
            setBudgets(budgets.map(budget=>
            {if(budget.id===budgetID){
                return{...budget,
                    categories : [...budget.categories, {name: 'New Category', value: 0}]
                }
            }}
            ))
        }
    
        const removeCategory=(budgetID, categoryIndex)=>{
            setBudgets(budgets.map(budget=>{
                if(budget.id===budgetID){
                    return{
                        ...budget,
                        categories: budget.categories.filter((_,index)=>index!==categoryIndex)
                    }
                }
                return budget
            }))
        }

    const customer = [
        {id: 1, name:"Entertainment ", amount:50.00},
        {id: 2, name:"Bills", amount:750.00},
        {id: 3, name:"Personal Care", amount:100.00},
        {id: 4, name:"Dining Out", amount:75.00},
    ];    
    
    return(
        
        <div className="budgetBodyMain">

            <div className="budgetHeader">
            <h1 className="budgetHead">Budget</h1>
            <div className="topButtons">

                <div className="buttonBudget" onClick={createNewBudget()}>
                <i class="fa-solid fa-plus"></i>
                    <p>New Budget</p>
                </div>

                <div className="buttonBudget">
                <i class="fa-solid fa-plus"></i>
                    <p>New Auto-budget</p>
                </div>

            </div>
            </div>

            <div className="budgetBodyMain">

                <div className="budgetDiv">
                    <PieChartComp data={customer} />
                    <div className="budgetSection">
                        {customer.map(customer => <BudgetBar key={customer} budget={customer} />)}
                    </div>
                </div>

                <div className="budgetDiv">
                    <PieChartComp data={customer} />
                    <div className="budgetSection">
                        {customer.map(customer => <BudgetBar key={customer} budget={customer} />)}
                    </div>
                </div>

                <div className="budgetExamples">
                    <h3>{customer.name}</h3>
                    <p>{customer.value}</p>
                    <div className="fullBar"></div>
                    
                </div>

            </div>

        </div>
    )
}

export default BudgetPageContent;