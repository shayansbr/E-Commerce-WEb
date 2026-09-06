// ============================================================
// BIDDING LOGIC — device-detail.html
// Depends on firebase-config.js + auth.js + devices.js (for
// DEVICE_TYPES / CONDITION_LABELS / formatPrice / escapeHtml)
// being loaded first.
// ============================================================

function getDeviceIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function initDeviceDetail() {
  const container = document.getElementById("device-detail");
  if (!container) return;

  const deviceId = getDeviceIdFromUrl();
  if (!deviceId) {
    container.innerHTML = `<p>No device specified.</p>`;
    return;
  }

  let currentUser = null;
  let currentUserRole = null;
  let deviceData = null;

  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      const userDoc = await db.collection("users").doc(user.uid).get();
      currentUserRole = userDoc.exists ? userDoc.data().role : null;
    }
    renderBidBox();
  });

  // -------- Load device details (once) --------
  db.collection("devices").doc(deviceId).get().then((doc) => {
    if (!doc.exists) {
      container.innerHTML = `<p>This listing no longer exists.</p>`;
      return;
    }
    deviceData = doc.data();
    renderDevice(doc.id, deviceData);
    listenForBids(doc.id);
  });

  function renderDevice(id, d) {
    const gallery = (d.images || []).map((url) =>
      `<img src="${url}" alt="${escapeHtml(d.title)}" />`
    ).join("") || `<div class="detail-noimg">No photos</div>`;

    document.getElementById("device-gallery").innerHTML = gallery;
    document.getElementById("device-title").textContent = d.title;
    document.getElementById("device-type").textContent = DEVICE_TYPES[d.type] || "Device";
    document.getElementById("device-condition").textContent = CONDITION_LABELS[d.condition] || d.condition;
    document.getElementById("device-description").textContent = d.description || "No description provided.";
    document.getElementById("device-price").textContent = d.mode === "exchange" ? "Open to exchange" : formatPrice(d.askingPrice);
    document.getElementById("device-status").textContent = labelForStatus(d.status);
    document.getElementById("device-status").className = `device-card-status status-${d.status}`;
  }

  // -------- Live bid feed --------
  function listenForBids(id) {
    const bidList = document.getElementById("bid-list");
    db.collection("devices").doc(id).collection("bids")
      .orderBy("amount", "desc")
      .onSnapshot((snap) => {
        if (snap.empty) {
          bidList.innerHTML = `<p class="bid-empty">No bids yet — be the first.</p>`;
          return;
        }
        bidList.innerHTML = snap.docs.map((doc) => {
          const b = doc.data();
          const isOwner = currentUser && deviceData && currentUser.uid === deviceData.ownerId;
          const canAccept = isOwner && b.status === "pending" && deviceData.status !== "sold";
          return `
            <div class="bid-row">
              <div>
                <strong>${escapeHtml(b.vendorName || "Vendor")}</strong>
                <span class="bid-amount">${formatPrice(b.amount)}</span>
                ${b.message ? `<p class="bid-message">${escapeHtml(b.message)}</p>` : ""}
              </div>
              <div class="bid-row-right">
                <span class="bid-status bid-status-${b.status}">${b.status}</span>
                ${canAccept ? `<button class="btn btn-primary btn-sm" data-accept-bid="${doc.id}" data-amount="${b.amount}">Accept</button>` : ""}
              </div>
            </div>
          `;
        }).join("");

        bidList.querySelectorAll("[data-accept-bid]").forEach((btn) => {
          btn.addEventListener("click", () => acceptBid(id, btn.dataset.acceptBid, parseFloat(btn.dataset.amount)));
        });
      });
  }

  // -------- Bid box (vendor only) --------
  function renderBidBox() {
    const box = document.getElementById("bid-box");
    if (!box) return;

    if (!currentUser) {
      box.innerHTML = `<p class="bid-box-note">Log in as a vendor to place a bid.</p>`;
      return;
    }
    if (currentUserRole !== "vendor") {
      box.innerHTML = `<p class="bid-box-note">Only vendor accounts can place bids.</p>`;
      return;
    }

    box.innerHTML = `
      <div id="bid-error" class="form-error"></div>
      <form id="bid-form">
        <div class="field">
          <label for="bid-amount">Your bid (USD)</label>
          <input type="text" inputmode="decimal" id="bid-amount" required />
        </div>
        <div class="field">
          <label for="bid-message">Message (optional)</label>
          <input type="text" id="bid-message" placeholder="e.g. Can pick up today" />
        </div>
        <button type="submit" class="btn btn-primary btn-block">Place bid</button>
      </form>
    `;

    document.getElementById("bid-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("bid-error");
      clearError(errorEl);

      const amount = parseFloat(document.getElementById("bid-amount").value);
      const message = document.getElementById("bid-message").value.trim();

      if (isNaN(amount) || amount <= 0) {
        showError(errorEl, "Enter a valid bid amount.");
        return;
      }

      const submitBtn = e.target.querySelector("button[type='submit']");
      setLoading(submitBtn, true);
      try {
        await db.collection("devices").doc(deviceId).collection("bids").add({
          vendorId: currentUser.uid,
          vendorName: currentUser.displayName || currentUser.email,
          amount,
          message,
          status: "pending",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection("devices").doc(deviceId).update({ status: "in_bidding" });
        e.target.reset();
      } catch (err) {
        console.error(err);
        showError(errorEl, "Couldn't place your bid. Please try again.");
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  // -------- Accept bid (seller only) --------
  async function acceptBid(deviceId, bidId, amount) {
    if (!confirm(`Accept this bid for ${formatPrice(amount)}? This will close the listing to further bids.`)) return;

    const batch = db.batch();
    const deviceRef = db.collection("devices").doc(deviceId);
    const bidRef = deviceRef.collection("bids").doc(bidId);

    batch.update(deviceRef, { status: "sold", winningBidId: bidId });
    batch.update(bidRef, { status: "accepted" });

    // reject all other pending bids
    const otherBids = await deviceRef.collection("bids").where("status", "==", "pending").get();
    otherBids.forEach((doc) => {
      if (doc.id !== bidId) batch.update(doc.ref, { status: "rejected" });
    });

    await batch.commit();
  }
}

document.addEventListener("DOMContentLoaded", initDeviceDetail);
