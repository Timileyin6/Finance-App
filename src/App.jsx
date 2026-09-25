import { useState } from 'react'
import PageContent from './pages/LandingPage'
import TransactionPageLayout from './pages/TransactionPage';
import BudgetPageContent from './pages/BudgetPage';
import { Route, Routes } from 'react-router-dom';
import MenuBar from './components/SideBar';
import TheBudgetPage from './pages/BudgetPage2';
import './css/App.css'

function App() {

  const [closeBar, setCloseBar] = useState(true)
  
      const toggleSidebar = () => {
          setCloseBar(!closeBar)
      }
  
  return(
    <div className={closeBar === true ? "main height" : "new height"}>
      <MenuBar closeBar={closeBar} toggleSidebar={toggleSidebar}/>
    <div>
      <Routes>
        <Route path='/' element={<PageContent />} />
        <Route path='/Overview' element={<PageContent />} />
        <Route path='/Transactions' element={<TransactionPageLayout />} />
        <Route path='/Budgets' element={<BudgetPageContent />} />
        <Route path='/Pots' element={<TheBudgetPage />} />
      </Routes>
    </div>
    </div>
  );
}

export default App
