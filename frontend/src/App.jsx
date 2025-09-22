import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataProvider';
import Dashboard from './components/Dashboard';

// Grid Layout CSS
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

function App() {
	return (
        <AuthProvider>
		    <DataProvider>
			    <Dashboard />
		    </DataProvider>
        </AuthProvider>
	);
}

export default App;