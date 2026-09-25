import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import PieChartComp from "../components/PieChartComponent";
import BudgetBar from "../components/Budgets";
import { useState } from "react";
import '../css/BudgetPage2.css'

function TheBudgetPage(){

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

    return
        
        
    

    
}

export default TheBudgetPage;