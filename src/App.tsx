import { createHashRouter, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { HelpModal } from './pages/HelpPage'
import { PlanPage } from './pages/PlanPage'
import { PlanViewPage } from './pages/PlanViewPage'

function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const helpOpen = searchParams.get('help') === '1'

  const closeHelp = () => {
    const nextParams = new URLSearchParams(location.search)
    nextParams.delete('help')
    navigate({
      pathname: location.pathname,
      search: nextParams.size > 0 ? `?${nextParams.toString()}` : '',
    }, { replace: true })
  }

  return (
    <>
      <Outlet />
      {helpOpen && <HelpModal onClose={closeHelp} />}
    </>
  )
}

const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'plan/:id', element: <PlanPage /> },
      { path: 'plan/:id/view', element: <PlanViewPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
