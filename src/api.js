// api.js
export const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/data');  // Your backend API
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };
