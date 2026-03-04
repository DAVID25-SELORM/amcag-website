// ================================================================
// AMCAG NATIONAL DIGITAL GOVERNANCE ECOSYSTEM
// Firestore API Module - Data Access Layer
// ================================================================

const APIModule = (function() {
  'use strict';
  
  // ===== MEMBERS API =====
  const Members = {
    // Get all members
    async getAll(filters = {}) {
      try {
        let query = window.FirebaseModule.collections.members();
        
        // Apply filters
        if (filters.region) {
          query = query.where('region', '==', filters.region);
        }
        
        if (filters.status) {
          query = query.where('status', '==', filters.status);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        let query = window.FirebaseModule.collections.members();
        
        if (region) {
          query = query.where('region', '==', region);
        }
        
        const snapshot = await query.get();
        const members = snapshot.docs.map(doc => doc.data());
        
        return {
          total: members.length,
          active: members.filter(m => m.status === 'active').length,
          pending: members.filter(m => m.status === 'pending').length,
          suspended: members.filter(m => m.status === 'suspended').length
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
        let query = window.FirebaseModule.collections.payments();
        
        if (filters.memberId) {
          query = query.where('memberId', '==', filters.memberId);
        }
        
        if (filters.type) {
          query = query.where('type', '==', filters.type);
        }
        
        if (filters.status) {
          query = query.where('status', '==', filters.status);
        }
        
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        let query = window.FirebaseModule.collections.payments();
        
        if (filters.memberId) {
          query = query.where('memberId', '==', filters.memberId);
        }
        
        const snapshot = await query.get();
        const payments = snapshot.docs.map(doc => doc.data());
        
        const completed = payments.filter(p => p.status === 'completed');
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
        const snapshot = await window.FirebaseModule.collections.certificates()
          .where('memberId', '==', memberId)
          .orderBy('issueDate', 'desc')
          .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
