// ================================================================
// AMCAG NATIONAL DIGITAL GOVERNANCE ECOSYSTEM
// Firestore API Module - Data Access Layer
// ================================================================

const APIModule = (function() {
  'use strict';

  function isMissingIndexError(error) {
    const code = String(error && error.code ? error.code : '').toLowerCase();
    const message = String(error && error.message ? error.message : '').toLowerCase();
    return code.includes('failed-precondition') || message.includes('requires an index');
  }

  function getTimestampMs(value) {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function mapSnapshotDocs(snapshot) {
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  function normalizeValue(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getRecordRegion(record = {}) {
    return record.region || record.regionName || record.assignedRegion || record.regionId || '';
  }

  function getRecordStatus(record = {}) {
    return normalizeValue(record.status || record.approvalStatus || 'pending');
  }

  function getRecordUid(record = {}) {
    return record.uid || record.memberUid || record.id || '';
  }

  function sortByNewest(records) {
    return records.sort((a, b) => {
      const aTime = getTimestampMs(a.createdAt || a.registrationDate || a.joiningDate || a.approvedAt);
      const bTime = getTimestampMs(b.createdAt || b.registrationDate || b.joiningDate || b.approvedAt);
      return bTime - aTime;
    });
  }

  async function getDocsFromCollection(collectionName, region = '') {
    const collection = collectionName === 'users'
      ? window.FirebaseModule.collections.users()
      : window.FirebaseModule.collections.members();

    try {
      const snapshots = [];
      if (region) {
        const regionValue = String(region).trim();
        snapshots.push(await collection.where('region', '==', regionValue).get());
        snapshots.push(await collection.where('regionId', '==', regionValue).get().catch(() => ({ docs: [] })));
      } else {
        snapshots.push(await collection.get());
      }

      const recordsById = new Map();
      snapshots.forEach((snapshot) => {
        mapSnapshotDocs(snapshot).forEach((record) => {
          recordsById.set(record.id, record);
        });
      });

      return Array.from(recordsById.values()).map((record) => ({
        ...record,
        uid: getRecordUid(record) || record.id,
        sourceCollection: collectionName
      }));
    } catch (error) {
      console.warn(`Unable to fetch ${collectionName} collection:`, error);
      return [];
    }
  }

  async function getMergedMemberRecords(region = '') {
    const [userRecords, memberRecords] = await Promise.all([
      getDocsFromCollection('users', region),
      getDocsFromCollection('members', region)
    ]);

    const merged = new Map();
    memberRecords.forEach((record) => {
      const key = getRecordUid(record);
      if (key) merged.set(key, record);
    });

    userRecords
      .filter((record) => normalizeValue(record.role || 'member') === 'member')
      .forEach((record) => {
        const key = getRecordUid(record);
        if (!key) return;
        merged.set(key, {
          ...(merged.get(key) || {}),
          ...record,
          sourceCollection: merged.has(key) ? 'users+members' : 'users'
        });
      });

    return Array.from(merged.values());
  }

  function getCurrentProfile() {
    return window.AuthModule && window.AuthModule.getCurrentUser()
      ? window.AuthModule.getCurrentUser().profile || {}
      : {};
  }

  function applyGovernanceScope(collectionName, filters = {}) {
    const profile = getCurrentProfile();
    const scoped = { ...filters };
    const role = String(profile.role || '').toLowerCase();
    const region = profile.region || profile.regionId;

    if (role === 'regional_executive' && region && !scoped.region) {
      scoped.region = region;
    }

    if (collectionName === 'payments') {
      if (role === 'regional_executive' && !window.AuthModule.hasPermission('canViewRegionalPayments')) {
        scoped.uid = window.AuthModule.getCurrentUser()?.uid || '__blocked__';
      }

      if (role === 'national_executive' && !window.AuthModule.hasPermission('canViewNationalPayments')) {
        scoped.uid = window.AuthModule.getCurrentUser()?.uid || '__blocked__';
      }
    }

    return scoped;
  }
  
  // ===== MEMBERS API =====
  const Members = {
    // Get all members
    async getAll(filters = {}) {
      try {
        filters = applyGovernanceScope('members', filters);
        const targetRegion = normalizeValue(filters.region);
        const targetStatus = normalizeValue(filters.status);

        return sortByNewest((await getMergedMemberRecords(filters.region)).filter((member) => {
          const matchesRegion = !targetRegion || normalizeValue(getRecordRegion(member)) === targetRegion;
          const matchesStatus = !targetStatus || getRecordStatus(member) === targetStatus;
          return matchesRegion && matchesStatus;
        }));
      } catch (error) {
        console.error('Error fetching members:', error);
        throw error;
      }
    },
    
    // Get member by ID
    async getById(id) {
      try {
        const doc = await window.FirebaseModule.collections.members().doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
      } catch (error) {
        console.error('Error fetching member:', error);
        throw error;
      }
    },
    
    // Create new member
    async create(memberData) {
      try {
        const docRef = await window.FirebaseModule.collections.members().add({
          ...memberData,
          createdAt: window.FirebaseModule.timestamp.now(),
          updatedAt: window.FirebaseModule.timestamp.now()
        });
        
        return { id: docRef.id, ...memberData };
      } catch (error) {
        console.error('Error creating member:', error);
        throw error;
      }
    },
    
    // Update member
    async update(id, updates) {
      try {
        await window.FirebaseModule.collections.members()
          .doc(id)
          .update({
            ...updates,
            updatedAt: window.FirebaseModule.timestamp.now()
          });
        
        return { id, ...updates };
      } catch (error) {
        console.error('Error updating member:', error);
        throw error;
      }
    },
    
    // Delete member
    async delete(id) {
      try {
        await window.FirebaseModule.collections.members().doc(id).delete();
        return { success: true };
      } catch (error) {
        console.error('Error deleting member:', error);
        throw error;
      }
    },
    
    // Get member statistics
    async getStats(region = null) {
      try {
        const scoped = applyGovernanceScope('members', region ? { region } : {});
        const members = await Members.getAll(scoped.region ? { region: scoped.region } : {});
        
        return {
          total: members.length,
          active: members.filter(m => getRecordStatus(m) === 'active').length,
          pending: members.filter(m => getRecordStatus(m) === 'pending').length,
          suspended: members.filter(m => getRecordStatus(m) === 'suspended').length
        };
      } catch (error) {
        console.error('Error fetching member stats:', error);
        throw error;
      }
    }
  };
  
  // ===== PAYMENTS API =====
  const Payments = {
    // Get all payments
    async getAll(filters = {}) {
      try {
        filters = applyGovernanceScope('payments', filters);
        let query = window.FirebaseModule.collections.payments();
        
        if (filters.uid) {
          query = query.where('uid', '==', filters.uid);
        } else if (filters.memberId) {
          query = query.where('memberId', '==', filters.memberId);
        }
        
        if (filters.type) {
          query = query.where('type', '==', filters.type);
        }
        
        if (filters.status) {
          query = query.where('status', '==', filters.status);
        }

        if (filters.region) {
          query = query.where('region', '==', filters.region);
        }
        
        try {
          const snapshot = await query.orderBy('createdAt', 'desc').get();
          return mapSnapshotDocs(snapshot);
        } catch (queryError) {
          if (!isMissingIndexError(queryError)) throw queryError;

          console.warn('Payments ordered query index is not ready; using client-side sort fallback.', queryError);
          const snapshot = await query.get();
          return mapSnapshotDocs(snapshot)
            .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
        }
      } catch (error) {
        console.error('Error fetching payments:', error);
        throw error;
      }
    },
    
    // Create payment record
    async create(paymentData) {
      try {
        const docRef = await window.FirebaseModule.collections.payments().add({
          ...paymentData,
          status: paymentData.status || 'pending',
          createdAt: window.FirebaseModule.timestamp.now(),
          updatedAt: window.FirebaseModule.timestamp.now()
        });
        
        return { id: docRef.id, ...paymentData };
      } catch (error) {
        console.error('Error creating payment:', error);
        throw error;
      }
    },
    
    // Update payment status
    async updateStatus(id, status, reference = null) {
      try {
        const updates = {
          status,
          updatedAt: window.FirebaseModule.timestamp.now()
        };
        
        if (reference) {
          updates.reference = reference;
        }
        
        if (status === 'completed') {
          updates.completedAt = window.FirebaseModule.timestamp.now();
        }
        
        await window.FirebaseModule.collections.payments().doc(id).update(updates);
        return { success: true };
      } catch (error) {
        console.error('Error updating payment status:', error);
        throw error;
      }
    },
    
    // Get payment statistics
    async getStats(filters = {}) {
      try {
        filters = applyGovernanceScope('payments', filters);
        let query = window.FirebaseModule.collections.payments();
        
        if (filters.uid) {
          query = query.where('uid', '==', filters.uid);
        } else if (filters.memberId) {
          query = query.where('memberId', '==', filters.memberId);
        }

        if (filters.region) {
          query = query.where('region', '==', filters.region);
        }
        
        const snapshot = await query.get();
        const payments = snapshot.docs.map(doc => doc.data());
        
        const completed = payments.filter(p => ['completed', 'paid'].includes(String(p.status || '').toLowerCase()));
        const totalAmount = completed.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        return {
          total: payments.length,
          completed: completed.length,
          pending: payments.filter(p => p.status === 'pending').length,
          failed: payments.filter(p => p.status === 'failed').length,
          totalAmount
        };
      } catch (error) {
        console.error('Error fetching payment stats:', error);
        throw error;
      }
    }
  };
  
  // ===== EVENTS API =====
  const Events = {
    // Get all events
    async getAll(filters = {}) {
      try {
        filters = applyGovernanceScope('events', filters);
        let query = window.FirebaseModule.collections.events();
        
        if (filters.region) {
          query = query.where('region', '==', filters.region);
        }
        
        if (filters.upcoming) {
          const now = new Date();
          query = query.where('eventDate', '>=', now);
        }
        
        const snapshot = await query.orderBy('eventDate', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
    
    // Get event by ID
    async getById(id) {
      try {
        const doc = await window.FirebaseModule.collections.events().doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
      } catch (error) {
        console.error('Error fetching event:', error);
        throw error;
      }
    },
    
    // Create event
    async create(eventData) {
      try {
        const docRef = await window.FirebaseModule.collections.events().add({
          ...eventData,
          createdAt: window.FirebaseModule.timestamp.now(),
          updatedAt: window.FirebaseModule.timestamp.now()
        });
        
        return { id: docRef.id, ...eventData };
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    },
    
    // Update event
    async update(id, updates) {
      try {
        await window.FirebaseModule.collections.events()
          .doc(id)
          .update({
            ...updates,
            updatedAt: window.FirebaseModule.timestamp.now()
          });
        
        return { id, ...updates };
      } catch (error) {
        console.error('Error updating event:', error);
        throw error;
      }
    },
    
    // Delete event
    async delete(id) {
      try {
        await window.FirebaseModule.collections.events().doc(id).delete();
        return { success: true };
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    }
  };
  
  // ===== CERTIFICATES API =====
  const Certificates = {
    // Verify certificate
    async verify(certificateId) {
      try {
        const doc = await window.FirebaseModule.collections.certificates()
          .doc(certificateId)
          .get();
        
        if (!doc.exists) {
          return { valid: false, message: 'Certificate not found' };
        }
        
        const certData = doc.data();
        
        return {
          valid: true,
          certificate: {
            id: doc.id,
            ...certData
          }
        };
      } catch (error) {
        console.error('Error verifying certificate:', error);
        throw error;
      }
    },
    
    // Get certificates by member
    async getByMember(memberId) {
      try {
        const collection = window.FirebaseModule.collections.certificates();
        const snapshots = await Promise.all([
          collection.where('memberUid', '==', memberId).get().catch(() => ({ docs: [] })),
          collection.where('memberId', '==', memberId).get().catch(() => ({ docs: [] }))
        ]);

        const certificatesById = new Map();
        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((doc) => {
            certificatesById.set(doc.id, { id: doc.id, ...doc.data() });
          });
        });

        return Array.from(certificatesById.values()).sort((a, b) => {
          const aTime = getTimestampMs(a.issuedAt || a.issueDate || a.createdAt);
          const bTime = getTimestampMs(b.issuedAt || b.issueDate || b.createdAt);
          return bTime - aTime;
        });
      } catch (error) {
        console.error('Error fetching certificates:', error);
        throw error;
      }
    },
    
    // Issue certificate
    async issue(certificateData) {
      try {
        // Generate unique certificate ID
        const certId = `AMCAG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        await window.FirebaseModule.collections.certificates().doc(certId).set({
          ...certificateData,
          status: 'active',
          issueDate: window.FirebaseModule.timestamp.now(),
          createdAt: window.FirebaseModule.timestamp.now()
        });
        
        return { id: certId, ...certificateData };
      } catch (error) {
        console.error('Error issuing certificate:', error);
        throw error;
      }
    }
  };
  
  // ===== REGIONS API =====
  const Regions = {
    // Get all regions
    async getAll() {
      try {
        const snapshot = await window.FirebaseModule.collections.regions()
          .orderBy('name')
          .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error('Error fetching regions:', error);
        throw error;
      }
    },
    
    // Get region by ID
    async getById(id) {
      try {
        const doc = await window.FirebaseModule.collections.regions().doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
      } catch (error) {
        console.error('Error fetching region:', error);
        throw error;
      }
    }
  };
  
  // ===== MEDIA API =====
  const Media = {
    // Get gallery photos
    async getPhotos(filters = {}) {
      try {
        let query = window.FirebaseModule.collections.gallery();
        
        if (filters.category) {
          query = query.where('category', '==', filters.category);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error('Error fetching photos:', error);
        throw error;
      }
    },
    
    // Get videos
    async getVideos() {
      try {
        const snapshot = await window.FirebaseModule.collections.videos()
          .orderBy('createdAt', 'desc')
          .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error('Error fetching videos:', error);
        throw error;
      }
    },
    
    // Upload file
    async uploadFile(file, path) {
      try {
        const storageRef = window.FirebaseModule.storage().ref(`${path}/${file.name}`);
        const uploadTask = await storageRef.put(file);
        const downloadURL = await uploadTask.ref.getDownloadURL();
        
        return { url: downloadURL, path: uploadTask.ref.fullPath };
      } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
      }
    }
  };
  
  // ===== NEWS & ANNOUNCEMENTS API =====
  const News = {
    // Get all news/announcements
    async getAll(type = 'news') {
      try {
        const collection = type === 'news' 
          ? window.FirebaseModule.collections.news()
          : window.FirebaseModule.collections.announcements();
        
        const snapshot = await collection.orderBy('publishDate', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error('Error fetching news:', error);
        throw error;
      }
    },
    
    // Get by ID
    async getById(id, type = 'news') {
      try {
        const collection = type === 'news' 
          ? window.FirebaseModule.collections.news()
          : window.FirebaseModule.collections.announcements();
        
        const doc = await collection.doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
      } catch (error) {
        console.error('Error fetching news item:', error);
        throw error;
      }
    },
    
    // Create news/announcement
    async create(data, type = 'news') {
      try {
        const collection = type === 'news' 
          ? window.FirebaseModule.collections.news()
          : window.FirebaseModule.collections.announcements();
        
        const docRef = await collection.add({
          ...data,
          publishDate: window.FirebaseModule.timestamp.now(),
          createdAt: window.FirebaseModule.timestamp.now(),
          updatedAt: window.FirebaseModule.timestamp.now()
        });
        
        return { id: docRef.id, ...data };
      } catch (error) {
        console.error('Error creating news:', error);
        throw error;
      }
    }
  };
  
  // ===== LEADERSHIP API =====
  const Leadership = {
    // Get all leadership
    async getAll(level = null) {
      try {
        let query = window.FirebaseModule.collections.leadership();
        
        if (level) {
          query = query.where('level', '==', level);
        }
        
        const snapshot = await query.orderBy('priority').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error('Error fetching leadership:', error);
        throw error;
      }
    }
  };
  
  // ===== PUBLIC API =====
  return {
    Members,
    Payments,
    Events,
    Certificates,
    Regions,
    Media,
    News,
    Leadership
  };
})();

// Export to window
window.APIModule = APIModule;
