// ============================================
// Download Queue System - Practical Examples
// ============================================

// ============================================
// EXAMPLE 1: Adding Single Songs to Queue
// ============================================

// When user clicks download button on a song card
function downloadSongFromCard(song) {
    addToDownloadQueue(song);
    // Toast message: "Song added to download queue"
    // Queue panel opens automatically
}

// ============================================
// EXAMPLE 2: Batch Download Entire Artist
// ============================================

// Add all songs from current artist to queue
function downloadEntireArtist() {
    if (!currentArtistKey || !artists[currentArtistKey]) return;

    const artist = artists[currentArtistKey];
    const songs = artist.songs.filter(s => !isDownloaded(s.file));

    if (songs.length === 0) {
        showToast('All songs already downloaded');
        return;
    }

    songs.forEach(song => {
        song.artistName = artist.name; // Ensure artist name is set
    });

    downloadQueue.addMultipleToQueue(songs);
    document.getElementById('downloadQueuePanel').classList.add('visible');
    showToast(`Added ${songs.length} songs to queue`);
}

// ============================================
// EXAMPLE 3: Batch Download from Playlist
// ============================================

function addPlaylistToQueue(playlistSongs) {
    const undownloaded = playlistSongs.filter(s => !isDownloaded(s.file));

    if (undownloaded.length === 0) {
        showToast('All playlist songs already downloaded');
        return;
    }

    downloadQueue.addMultipleToQueue(undownloaded);
    document.getElementById('downloadQueuePanel').classList.add('visible');
}

// ============================================
// EXAMPLE 4: Queue Status Monitoring
// ============================================

// Check queue statistics
function getQueueInfo() {
    const stats = downloadQueue.getStats();
    console.log(`Queue Status:
        Total: ${stats.total}
        Queued: ${stats.queued}
        Downloading: ${stats.downloading}
        Completed: ${stats.completed}
        Errors: ${stats.error}
    `);
}

// Check if specific song is in queue
function isSongInQueue(fileId) {
    const item = downloadQueue.getQueueItem(fileId);
    return item !== null;
}

// Get current status of a song in queue
function getSongQueueStatus(fileId) {
    const item = downloadQueue.getQueueItem(fileId);
    if (!item) return null;

    return {
        status: item.status, // queued, downloading, completed, error
        progress: item.progress, // 0-100
        error: item.error // null if no error
    };
}

// ============================================
// EXAMPLE 5: Queue Event Listeners
// ============================================

// The queue automatically calls handleQueueStatusChange on any status change
// Here are examples of what you can do with these events:

const originalStatusChangeHandler = handleQueueStatusChange;

function handleQueueStatusChange(event) {
    const { type, data, stats } = event;

    // Handle different event types
    switch (type) {
        case 'statusChange':
            console.log(`${data.song.title}: ${data.status} (${data.progress}%)`);

            // Example: Play notification when download completes
            if (data.status === 'completed') {
                // Play a success sound or notification
                playNotificationSound();
            }

            // Example: Show warning if download fails
            if (data.status === 'error') {
                console.warn(`Download failed: ${data.song.title}`);
                console.warn(`Error: ${data.error}`);
            }
            break;

        case 'progressChange':
            // Progress bar updates happen automatically in UI
            // You can add custom logic here if needed
            break;

        case 'itemRemoved':
            console.log(`${data.song.title} removed from queue`);
            break;

        case 'queueEmpty':
            console.log('All downloads completed!');
            showToast('All downloads completed ✓');
            break;

        case 'cancelled':
            console.log('Queue cancelled');
            break;
    }

    // Call original handler for UI updates
    originalStatusChangeHandler(event);
}

// ============================================
// EXAMPLE 6: Conditional Queue Additions
// ============================================

// Only add if user has sufficient storage
function smartAddToQueue(song) {
    // Check estimated size (in this case, assume ~5MB per song)
    const estimatedSize = 5 * 1024 * 1024; // 5MB

    // Get current cache size (approximate)
    caches.open(CACHE_NAME).then(cache => {
        cache.keys().then(keys => {
            const estimatedCacheSize = keys.length * estimatedSize;
            const maxStorage = 50 * 1024 * 1024; // 50MB limit

            if (estimatedCacheSize + estimatedSize > maxStorage) {
                showToast('⚠ Storage almost full. Consider clearing old downloads.');
            }
        });
    });

    addToDownloadQueue(song);
}

// ============================================
// EXAMPLE 7: Custom Queue Management UI
// ============================================

// Get all queued items (not yet downloading/completed)
function getQueuedItems() {
    return downloadQueue.getQueue().filter(item =>
        item.status === 'queued'
    );
}

// Get currently downloading item
function getCurrentlyDownloading() {
    return downloadQueue.getQueue().find(item =>
        item.status === 'downloading'
    );
}

// Get failed downloads for retry
function getFailedDownloads() {
    return downloadQueue.getQueue().filter(item =>
        item.status === 'error'
    );
}

// Retry all failed downloads
function retryFailedDownloads() {
    const failed = getFailedDownloads();

    if (failed.length === 0) {
        showToast('No failed downloads to retry');
        return;
    }

    failed.forEach(item => {
        // Change status back to queued
        item.status = downloadQueue.STATUSES.QUEUED;
        item.error = null;
    });

    // Resume processing
    if (!downloadQueue.isDownloading && downloadQueue.queue.length > 0) {
        downloadQueue.processQueue();
    }

    showToast(`Retrying ${failed.length} downloads...`);
}

// ============================================
// EXAMPLE 8: Auto-Download New Songs
// ============================================

// Setup periodic auto-download (e.g., new artist releases)
function setupAutoDownloadNewReleases() {
    setInterval(() => {
        const stats = downloadQueue.getStats();

        // Only auto-add if queue is empty or nearly empty
        if (stats.total < 3) {
            // Get some undownloaded songs from favorites
            const undownloaded = Array.from(likedSongs)
                .map(fileId => {
                    for (let key in artists) {
                        const song = artists[key].songs.find(s => s.file === fileId);
                        if (song) {
                            song.artistName = artists[key].name;
                            return song;
                        }
                    }
                })
                .filter(s => s && !isDownloaded(s.file))
                .slice(0, 3);

            if (undownloaded.length > 0) {
                downloadQueue.addMultipleToQueue(undownloaded);
            }
        }
    }, 300000); // Check every 5 minutes
}

// ============================================
// EXAMPLE 9: Export/Import Queue
// ============================================

// Save queue to localStorage for persistence
function saveQueueState() {
    const queue = downloadQueue.getQueue();
    const queueState = queue.map(item => ({
        fileId: item.song.file,
        status: item.status
    }));
    localStorage.setItem('eq_download_queue', JSON.stringify(queueState));
}

// Restore queue from localStorage on app load
function restoreQueueState() {
    const saved = localStorage.getItem('eq_download_queue');
    if (!saved) return;

    try {
        const queueState = JSON.parse(saved);
        // Re-add songs that didn't complete
        queueState.forEach(item => {
            if (item.status !== 'completed') {
                for (let key in artists) {
                    const song = artists[key].songs.find(s => s.file === item.fileId);
                    if (song) {
                        song.artistName = artists[key].name;
                        downloadQueue.addToQueue(song);
                    }
                }
            }
        });
    } catch (e) {
        console.warn('Could not restore queue state:', e);
    }
}

// ============================================
// EXAMPLE 10: Queue with Offline Indicators
// ============================================

// Update all songs display to show queue status
function updateSongQueueIndicators() {
    document.querySelectorAll('.dl-btn').forEach(btn => {
        const fileId = btn.dataset.fileId;
        const item = downloadQueue.getQueueItem(fileId);

        if (item) {
            // Change button based on queue status
            if (item.status === 'downloading') {
                btn.classList.add('downloading');
                btn.textContent = '⏳';
            } else if (item.status === 'queued') {
                btn.classList.add('downloading');
                btn.textContent = '⏱';
            } else if (item.status === 'completed') {
                btn.classList.add('downloaded');
                btn.textContent = '✓';
            } else if (item.status === 'error') {
                btn.classList.add('error');
                btn.textContent = '⚠';
            }
        }
    });
}

// ============================================
// EXAMPLE 11: Download All Liked Songs
// ============================================

function downloadAllLikedSongs() {
    const songs = [];

    for (let key in artists) {
        artists[key].songs.forEach(song => {
            if (likedSongs.has(song.file) && !isDownloaded(song.file)) {
                song.artistName = artists[key].name;
                songs.push(song);
            }
        });
    }

    if (songs.length === 0) {
        showToast('All liked songs already downloaded');
        return;
    }

    downloadQueue.addMultipleToQueue(songs);
    document.getElementById('downloadQueuePanel').classList.add('visible');
    showToast(`${songs.length} liked songs added to queue`);
}

// ============================================
// EXAMPLE 12: Integration with Search Results
// ============================================

// Add all search results to queue
function downloadSearchResults() {
    if (!window.__searchResults) {
        showToast('No search results');
        return;
    }

    const songs = window.__searchResults.filter(s => !isDownloaded(s.file));

    if (songs.length === 0) {
        showToast('All results already downloaded');
        return;
    }

    downloadQueue.addMultipleToQueue(songs);
    document.getElementById('downloadQueuePanel').classList.add('visible');
    showToast(`${songs.length} songs added to queue`);
}

// ============================================
// INITIALIZATION EXAMPLE
// ============================================

// On app startup:
document.addEventListener('DOMContentLoaded', () => {
    // Initialize queue system
    initializeDownloadQueue();

    // Restore previous queue state if desired
    // restoreQueueState();

    // Setup auto-download of new releases
    // setupAutoDownloadNewReleases();

    // Save queue state periodically
    setInterval(saveQueueState, 30000); // Every 30 seconds
});

// On app exit/page unload:
window.addEventListener('beforeunload', () => {
    saveQueueState();
});

// ============================================
// USAGE IN HTML ELEMENTS
// ============================================

// Add these to buttons in your UI:

// Download single song
// <button onclick="addToDownloadQueue(currentSong)">📥</button>

// Download entire artist
// <button onclick="downloadEntireArtist()">📥 Artist</button>

// Download all liked songs
// <button onclick="downloadAllLikedSongs()">📥 Liked</button>

// Show queue panel
// <button onclick="toggleDownloadQueue()">📥 Queue</button>

// Clear queue
// <button onclick="clearDownloadQueue()">🗑 Clear</button>

// Retry failed
// <button onclick="retryFailedDownloads()">🔄 Retry</button>

// ============================================
// TIPS & BEST PRACTICES
// ============================================

/*
1. Always check if song is downloaded before adding:
   if (!isDownloaded(song.file)) { ... }

2. Set artistName when manually creating song objects:
   song.artistName = 'Artist Name'

3. Toast notifications for user feedback:
   showToast('Song added to queue')

4. Respect storage limits (especially on mobile):
   Check available storage before bulk operations

5. Show queue panel when adding items:
   document.getElementById('downloadQueuePanel').classList.add('visible')

6. Use getStats() to show progress:
   Stats include: total, queued, downloading, completed, error

7. Handle errors gracefully:
   Failed downloads show status 'error' and remain in queue

8. Save queue state for offline access:
   Use localStorage to persist queue between sessions

9. Rate limit batch operations:
   Don't add thousands of items at once

10. Provide user feedback:
    Use toast messages, badges, and visual indicators
*/