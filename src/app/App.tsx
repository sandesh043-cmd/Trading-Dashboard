import { AuthGate } from '../features/auth/components/AuthGate'
import { PortfolioPage } from '../features/portfolio/pages/PortfolioPage'

function App() {
  return (
    <AuthGate>
      {({ userEmail, onSignOut }) => (
        <PortfolioPage userEmail={userEmail} onSignOut={onSignOut} />
      )}
    </AuthGate>
  )
}

export default App
