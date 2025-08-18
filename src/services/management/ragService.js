import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/* RAG Collections endpoints */
export async function getEntityRAGCollections(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch RAG collections for entity ${entityId}`);
    return await resp.json();
}

export async function getEntityRAGCollectionDetails(entityId, collectionName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch collection details for ${collectionName} in entity ${entityId}`);
    return await resp.json();
}

export async function getEntityRAGCollectionDocuments(entityId, collectionName, archetype = '', category = '') {
    let url = `${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/documents`;
    const params = new URLSearchParams();
    if (archetype) params.append('archetype', archetype);
    if (category) params.append('category', category);
    if (params.toString()) url += `?${params.toString()}`;

    const resp = await fetch(url, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch documents for collection ${collectionName} in entity ${entityId}`);
    return await resp.json();
}

export async function getEntityRAGDocumentDetails(entityId, collectionName, documentId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(documentId)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch document details for ${documentId} in collection ${collectionName} of entity ${entityId}`);
    return await resp.json();
}

export async function deleteEntityRAGDocument(entityId, collectionName, documentId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to delete document ${documentId} from collection ${collectionName} in entity ${entityId}`);
    return await resp.json();
}

export async function testEntityRAGSimilarityQuery(entityId, collectionName, query, limit = 10, archetype = '', category = '') {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/test-query`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({
            query,
            limit,
            archetype,
            category
        })
    });
    await handleResponse(resp, `Failed to test similarity query for collection ${collectionName} in entity ${entityId}`);
    return await resp.json();
}

export async function getEntityRAGCollectionGroups(entityId, collectionName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/groups`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch grouped view for collection ${collectionName} in entity ${entityId}`);
    return await resp.json();
}

export async function getEntityRAGGroupDocuments(entityId, collectionName, archetype, groupName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/groups/${encodeURIComponent(archetype)}/${encodeURIComponent(groupName)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch group documents for ${archetype}/${groupName} in collection ${collectionName} of entity ${entityId}`);
    return await resp.json();
}

export async function updateEntityRAGDocument(entityId, collectionName, documentId, newContent) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(documentId)}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({
            content: newContent
        })
    });
    await handleResponse(resp, `Failed to update document ${documentId} in collection ${collectionName} of entity ${entityId}`);
    return await resp.json();
}

export async function addEntityRAGDocumentToGroup(entityId, collectionName, archetype, groupName, category, content) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/groups/${encodeURIComponent(archetype)}/${encodeURIComponent(groupName)}/${encodeURIComponent(category)}`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({
            content
        })
    });
    await handleResponse(resp, `Failed to add document to group ${archetype}/${groupName}/${category} in collection ${collectionName} of entity ${entityId}`);
    return await resp.json();
}

export async function deleteEntityRAGGroup(entityId, collectionName, archetype, groupName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/rag/collections/${encodeURIComponent(collectionName)}/groups/${encodeURIComponent(archetype)}/${encodeURIComponent(groupName)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to delete group ${archetype}/${groupName} from collection ${collectionName} in entity ${entityId}`);
    return await resp.json();
}
