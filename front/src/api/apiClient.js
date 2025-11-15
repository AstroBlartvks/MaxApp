// Используем переменную окружения или значение по умолчанию
const API_URL = import.meta.env.VITE_API_URL || '';

let accessToken = localStorage.getItem('accessToken');

const storeTokens = (newAccessToken, newRefreshToken) => {
    accessToken = newAccessToken;
    localStorage.setItem('accessToken', newAccessToken);
    if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
    }
};

const clearTokens = () => {
    accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
};

const refreshAuth = async (isProactive = false) => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        storeTokens(data.access_token, data.refresh_token);
        
        return true; 
    } catch (error) {
        console.error("Refresh token failed:", error);
        clearTokens();
        return false;
    }
};

const request = async (endpoint, options = {}) => {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    if (response.status === 401) {
        const success = await refreshAuth(false); 
        if (success) {
            headers['Authorization'] = `Bearer ${accessToken}`; 
            response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        } else {
            window.location.href = '/'; 
            throw new Error('Session expired. Please log in again.');
        }
    }

    if (response.status === 204) {
        return null; 
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred' }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};

const login = async (initData) => {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ init_data: initData }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        storeTokens(data.access_token, data.refresh_token);
        return data;
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    }
};

const proactiveRefresh = async () => {
    try {
        return await refreshAuth(true); 
    } catch (error) {
        console.error("Proactive refresh failed. Session may be invalid.");
        return false;
    }
};

const apiClient = {
    login,
    request,
    proactiveRefresh,
    getPhotos: () => {
        return request('/api/photos');
    },
    uploadPhotos: async (formData) => {
        const makeRequest = async (authToken) => {
            const headers = {};
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
            return fetch(`${API_URL}/api/photos/upload`, {
                method: 'POST',
                headers,
                body: formData,
            });
        };
        
        let response = await makeRequest(accessToken);
        
        if (response.status === 401) {
            const success = await refreshAuth(false);
            if (success) {
                // FormData cannot be reused, so we need to recreate it
                // However, since we can't recreate FormData from the original files,
                // we'll just retry with the new token
                // Note: This might fail if FormData was consumed, but it's better than nothing
                response = await makeRequest(accessToken);
            } else {
                window.location.href = '/';
                throw new Error('Session expired. Please log in again.');
            }
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
            throw new Error(errorData.detail || 'Upload failed');
        }
        
        return response.json();
    },
    checkPhotoUsage: (photoIds) => {
        return request('/api/photos/check-usage', {
            method: 'POST',
            body: JSON.stringify({ photo_ids: photoIds }),
        });
    },
    deletePhotos: (photoIds) => {
        return request('/api/photos/', {
            method: 'DELETE',
            body: JSON.stringify({ photo_ids: photoIds }),
        });
    },
    isLoggedIn: () => {
        accessToken = localStorage.getItem('accessToken');
        return !!accessToken;
    },
    logout: () => {
        clearTokens();
    },
    createShareTrades: (artObjectIds) => {
        return request('/trades/create-share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art_object_ids: artObjectIds }),
        });
    },
    initiateTrade: (artObjectId) => {
        return request(`/trades/initiate?art_object_id=${artObjectId}`, {
            method: 'POST',
        });
    },
    getTradeStatus: (tradeId) => {
        return request(`/trades/${tradeId}`);
    },
    getScannedTrades: () => {
        return request('/trades/scanned');
    },
    scanShareToken: (shareToken) => {
        return request(`/trades/scan-share/${shareToken}`, {
            method: 'POST',
        });
    },
    scanTrade: (tradeId) => {
        return request(`/trades/${tradeId}/scan`, {
            method: 'POST',
        });
    },
    confirmTrade: (tradeId) => {
        return request(`/trades/${tradeId}/confirm`, {
            method: 'POST',
        });
    },
    rejectTrade: (tradeId) => {
        return request(`/trades/${tradeId}/reject`, {
            method: 'POST',
        });
    },
    createProfileRequest: (targetUserId) => {
        return request('/api/profile-requests/create', {
            method: 'POST',
            body: JSON.stringify({ target_user_id: targetUserId }),
        });
    },
    getPendingProfileRequests: () => {
        return request('/api/profile-requests/pending');
    },
    respondToProfileRequest: (requestId, approved, photoIds) => {
        return request(`/api/profile-requests/${requestId}/respond`, {
            method: 'POST',
            body: JSON.stringify({ approved, photo_ids: photoIds }),
        });
    },
    getApprovedPhotos: (requestId) => {
        return request(`/api/profile-requests/${requestId}/photos`);
    },
    getUserInfo: (userId) => {
        return request(`/api/profile-requests/user/${userId}`);
    },
    getUserApprovedPhotos: (userId) => {
        return request(`/api/profile-requests/user/${userId}/approved-photos`);
    },
    getRequestStatus: (userId) => {
        return request(`/api/profile-requests/user/${userId}/request-status`);
    },
    getMyPermissions: () => {
        return request('/api/profile-requests/my-permissions');
    },
    updatePermissionPhotos: (requestId, photoIds) => {
        // Убедимся, что requestId - это строка
        const requestIdStr = String(requestId);
        return request(`/api/profile-requests/${requestIdStr}/update-photos`, {
            method: 'PUT',
            body: JSON.stringify({ photo_ids: photoIds }),
        });
    },
    revokePermission: (requestId) => {
        return request(`/api/profile-requests/${requestId}/revoke`, {
            method: 'DELETE',
        });
    },
    importPhoto: (photoId) => {
        return request(`/api/photos/import/${photoId}`, {
            method: 'POST',
        });
    },
    removeImportedPhoto: (photoId) => {
        return request(`/api/photos/imported/${photoId}`, {
            method: 'DELETE',
        });
    },
    getImportedPhotoIds: () => {
        return request('/api/photos/imported/ids');
    },
    addFavorite: (photoId) => {
        return request(`/api/photos/favorite/${photoId}`, {
            method: 'POST',
        });
    },
    removeFavorite: (photoId) => {
        return request(`/api/photos/favorite/${photoId}`, {
            method: 'DELETE',
        });
    },
    getFavorites: () => {
        return request('/api/photos/favorites');
    },
    getFavoriteIds: () => {
        return request('/api/photos/favorites/ids');
    },
    updatePhotoMetadata: (photoId, description, tags, isPublic) => {
        const body = {};
        if (description !== undefined) body.description = description;
        if (tags !== undefined) body.tags = tags;
        if (isPublic !== undefined) body.is_public = isPublic;
        
        return request(`/api/photos/${photoId}/metadata`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },
    getPhotoMetadata: (photoId) => {
        return request(`/api/photos/${photoId}/metadata`);
    },
    togglePublicProfile: (isPublic) => {
        return request('/auth/toggle-public-profile', {
            method: 'POST',
            body: JSON.stringify({ is_public: isPublic }),
        });
    },
    getProfileSettings: () => {
        return request('/auth/profile-settings');
    },
    updateContactLink: (contactLink) => {
        return request('/auth/update-contact-link', {
            method: 'POST',
            body: JSON.stringify({ contact_link: contactLink }),
        });
    },
    getPublicPhotos: (limit = 20, offset = 0) => {
        return request(`/api/photos/public?limit=${limit}&offset=${offset}`);
    }
};

export default apiClient;
