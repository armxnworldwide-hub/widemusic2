/**
 * Download Queue Manager
 * Handles sequential downloads with status tracking and UI updates
 */

class DownloadQueue {
    constructor(cacheNameStorage = 'equify-songs', onStatusChange = null) {
        this.queue = []; // Array of {id, song, status, progress}
        this.isDownloading = false;
        this.currentDownload = null;
        this.cacheName = cacheNameStorage;
        this.STATUSES = {
            QUEUED: 'queued',
            DOWNLOADING: 'downloading',
            COMPLETED: 'completed',
            ERROR: 'error'
        };
        this.onStatusChange = onStatusChange; // Callback when status changes
    }

    /**
     * Add a song to the download queue
     * @param {Object} song - Song object with file, title, poster, etc.
     * @returns {string} - Queue item ID, or null if already in queue
     */
    addToQueue(song) {
        // Check if already in queue
        const exists = this.queue.find(item => item.song.file === song.file);
        if (exists) {
            console.log(`Song "${song.title}" already in queue`);
            return null;
        }

        // Create queue item
        const queueItem = {
            id: `${song.file}-${Date.now()}`,
            song: song,
            status: this.STATUSES.QUEUED,
            progress: 0,
            error: null,
            addedAt: new Date()
        };

        this.queue.push(queueItem);
        this.$notify('statusChange', queueItem);

        // Start processing if not already downloading
        if (!this.isDownloading) {
            this.processQueue();
        }

        return queueItem.id;
    }

    /**
     * Add multiple songs to queue
     * @param {Array} songs - Array of song objects
     * @returns {Array} - Array of queue IDs
     */
    addMultipleToQueue(songs) {
        return songs.map(song => this.addToQueue(song))
            .filter(id => id !== null);
    }

    /**
     * Remove item from queue
     * @param {string} queueItemId - ID of the queue item to remove
     */
    removeFromQueue(queueItemId) {
        const index = this.queue.findIndex(item => item.id === queueItemId);
        if (index > -1) {
            const item = this.queue[index];

            // Don't remove if currently downloading
            if (this.currentDownload && this.currentDownload.id === queueItemId) {
                console.warn('Cannot remove item currently downloading');
                return false;
            }

            this.queue.splice(index, 1);
            this.$notify('itemRemoved', item);
            return true;
        }
        return false;
    }

    /**
     * Get current queue
     * @returns {Array}
     */
    getQueue() {
        return [...this.queue];
    }

    /**
     * Get queue item by file name
     * @param {string} fileName
     * @returns {Object|null}
     */
    getQueueItem(fileName) {
        return this.queue.find(item => item.song.file === fileName) || null;
    }

    /**
     * Get queue statistics
     * @returns {Object}
     */
    getStats() {
        const stats = {
            total: this.queue.length,
            queued: 0,
            downloading: 0,
            completed: 0,
            error: 0
        };

        this.queue.forEach(item => {
            stats[item.status]++;
        });

        return stats;
    }

    /**
     * Process queue - download items sequentially
     * @private
     */
    async processQueue() {
        if (this.isDownloading || this.queue.length === 0) {
            return;
        }

        this.isDownloading = true;

        while (this.queue.length > 0) {
            const queueItem = this.queue[0]; // Get first item
            this.currentDownload = queueItem;

            // Update status to downloading
            queueItem.status = this.STATUSES.DOWNLOADING;
            this.$notify('statusChange', queueItem);

            // Perform the download
            const success = await this.$downloadFile(queueItem);

            if (success) {
                queueItem.status = this.STATUSES.COMPLETED;
                queueItem.progress = 100;
            } else {
                queueItem.status = this.STATUSES.ERROR;
            }

            this.$notify('statusChange', queueItem);

            // Remove from queue
            this.queue.shift();

            // Small delay between downloads
            await this.$delay(300);
        }

        this.isDownloading = false;
        this.currentDownload = null;
        this.$notify('queueEmpty', null);
    }

    /**
     * Download a single file
     * @private
     */
    async $downloadFile(queueItem) {
        const { song } = queueItem;
        const url = `songs/${song.file}`;

        try {
            const cache = await caches.open(this.cacheName);

            // Download main file
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Clone the response as it can only be used once
            const clonedResponse = response.clone();
            await cache.put(url, clonedResponse);

            // Try to cache poster image (non-critical)
            try {
                if (song.poster) {
                    const posterRes = await fetch(song.poster);
                    if (posterRes.ok) {
                        await cache.put(song.poster, posterRes.clone());
                    }
                }
            } catch (e) {
                console.warn('Could not cache poster:', e);
            }

            // Update progress
            queueItem.progress = 100;
            this.$notify('progressChange', queueItem);

            return true;
        } catch (error) {
            console.error('Download error:', error);
            queueItem.error = error.message;
            return false;
        }
    }

    /**
     * Clear the queue
     */
    clearQueue() {
        if (this.isDownloading) {
            console.warn('Cannot clear queue while downloading');
            return false;
        }
        this.queue = [];
        this.$notify('queueCleared', null);
        return true;
    }

    /**
     * Cancel current download and clear queue
     */
    cancelAll() {
        this.isDownloading = false;
        this.currentDownload = null;
        this.queue = [];
        this.$notify('cancelled', null);
    }

    /**
     * Notify subscribers of changes
     * @private
     */
    $notify(eventType, data) {
        if (this.onStatusChange) {
            this.onStatusChange({
                type: eventType,
                data: data,
                timestamp: Date.now(),
                queue: this.getQueue(),
                stats: this.getStats()
            });
        }
    }

    /**
     * Delay helper
     * @private
     */
    $delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadQueue;
}