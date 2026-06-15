import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export function useDatacenterHealth(datacenterName = null, hoursBack = 24) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                let url = `${API_BASE_URL}/getDatacenterHealth?hoursBack=${hoursBack}`;
                if (datacenterName) url += `&datacenterName=${encodeURIComponent(datacenterName)}`;
                
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                setData(json.data || json);
                setError(null);
            } catch (err) {
                setError(err.message);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [datacenterName, hoursBack]);

    return { data, loading, error };
}

export function useLabProfileHealth(labProfileName = null, hoursBack = 24) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                let url = `${API_BASE_URL}/getLabProfileHealth?hoursBack=${hoursBack}`;
                if (labProfileName) url += `&labProfileName=${encodeURIComponent(labProfileName)}`;
                
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                setData(json.data || json);
                setError(null);
            } catch (err) {
                setError(err.message);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [labProfileName, hoursBack]);

    return { data, loading, error };
}

export function useActiveErrors(hoursBack = 4) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE_URL}/getActiveErrors?hoursBack=${hoursBack}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                setData(json.data || json);
                setError(null);
            } catch (err) {
                setError(err.message);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [hoursBack]);

    return { data, loading, error };
}

export function useErrorDetails(labInstanceId = null, hoursBack = 4) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                let url = `${API_BASE_URL}/getErrorDetails?hoursBack=${hoursBack}`;
                if (labInstanceId) url += `&labInstanceId=${labInstanceId}`;
                
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                setData(json.data || json);
                setError(null);
            } catch (err) {
                setError(err.message);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [labInstanceId, hoursBack]);

    return { data, loading, error };
}

export function useGeoInsights() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE_URL}/getGeoInsights`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                setData(json.data || json);
                setError(null);
            } catch (err) {
                setError(err.message);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, []);

    return { data, loading, error };
}

export function useCompletionBreakdown(hoursBack = 24) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE_URL}/getCompletionBreakdown?hoursBack=${hoursBack}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                setData(json.data || json);
                setError(null);
            } catch (err) {
                setError(err.message);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [hoursBack]);

    return { data, loading, error };
}

export function useVpnSuspects(hoursBack = 24) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE_URL}/getVpnSuspects?hoursBack=${hoursBack}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                setData(json.data || json);
                setError(null);
            } catch (err) {
                setError(err.message);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [hoursBack]);

    return { data, loading, error };
}

export function useOverviewMetrics(days = 7) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE_URL}/getOverviewMetrics?days=${days}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const json = await res.json();
                setData(json.data || json);
                setError(null);
            } catch (err) {
                setError(err.message);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [days]);

    return { data, loading, error };
}
