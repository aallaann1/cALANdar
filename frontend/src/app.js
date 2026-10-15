const { createApp, ref, onMounted, watch, computed } = Vue;

const API_URL = '/api';
const FULL_API_URL = window.location.origin + '/api';

createApp({
    setup() {
        const user = ref(null);
        const currentTab = ref(localStorage.getItem('currentTab') || 'planning');
        
        watch(currentTab, (newTab) => {
            localStorage.setItem('currentTab', newTab);
            if (newTab === 'planning') {
                setTimeout(() => {
                    if (calendar) calendar.render();
                    else initCalendar();
                }, 100);
            }
            if (newTab === 'admin' && user.value && user.value.is_admin) {
                fetchTeams();
                fetchUsers();
            }
        });
        const loginForm = ref({ username: '', password: '' });
        const eventForm = ref({ user_ids: [], shift_type_id: '', start_time: '', end_time: '', editingEventIds: null });
        const shiftTypeForm = ref({ name: '', color: '#3788d8' });
        const inviteEmail = ref('');
        const teamMembers = ref([]);
        const shiftTypes = ref([]);
        const events = ref([]);
        const showEventModal = ref(false);
        const eventPopover = ref({ show: false, x: 0, y: 0, eventInfo: null });
        const allTeams = ref([]);
        const myTeam = ref(null);

        // Admin User Management states
        const adminSubTab = ref(localStorage.getItem('adminSubTab') || 'equipes'); // 'equipes' or 'utilisateurs'

        watch(adminSubTab, (newSubTab) => {
            localStorage.setItem('adminSubTab', newSubTab);
        });
        const allUsers = ref([]);
        const userSearch = ref('');
        const userFilterTeam = ref('');
        const userFilterStatus = ref('');
        const isImpersonating = ref(!!localStorage.getItem('admin_impersonator_token'));
        const impersonatedEmail = ref(localStorage.getItem('impersonated_user_email') || '');
        const showRoleModal = ref(false);
        const roleModalUser = ref(null);
        const roleModalForm = ref({ discord_role: 0 });
        const showDeleteUserModal = ref(false);
        const deleteUserTarget = ref(null);
        
        // Discord states
        const discordTab = ref(['tickets', 'panels'].includes(localStorage.getItem('discordTab')) ? localStorage.getItem('discordTab') : 'tickets');
        const discordStats = ref({});
        const discordPanels = ref([]);
        const discordTickets = ref([]);
        const discordChannels = ref([]);
        const discordSearch = ref('');
        const discordDateFilter = ref('');
        const discordSortDate = ref('desc');
        const ticketsPageSize = 25;
        const visibleTicketsLimit = ref(25);
        const isLoadingMoreTickets = ref(false);
        const showDiscordPanelModal = ref(false);
        const showDiscordPreviewModal = ref(false);
        const discordPanelForm = ref({ 
            id: null, name: '', 
            embed_title: '', embed_description: '', embed_color: '#3B82F6',
            button_text: '', button_emoji: '', button_color: 'primary',
            active_category_id: '', archive_category_id: '', ping_role_id: '', 
            ping_creator: true, max_tickets_per_user: 1,
            intro_message: '', inactivity_days: 3,
            close_button_text: 'Fermer le ticket',
            close_button_color: 'danger',
            close_button_emoji: '🔒',
            reopen_button_text: 'Ré-ouvrir',
            reopen_button_color: 'success',
            reopen_button_emoji: '🔓',
            delete_button_text: 'Supprimer',
            delete_button_color: 'danger',
            delete_button_emoji: '🗑️'
        });
        const showDiscordFieldsModal = ref(false);
        const discordFields = ref([]);
        const currentFieldPanelId = ref(null);
        const discordFieldForm = ref({ id: null, label: '', is_paragraph: false, required: true, order: 0 });
        const showDiscordDeployModal = ref(false);
        const discordDeployForm = ref({ panel_id: null, channel_id: '' });

        // Discord Bot Profile states
        const discordBotProfile = ref({
            id: '',
            username: '',
            avatar_url: '',
            avatar_preview: null
        });
        const isSavingBotProfile = ref(false);
        const botProfileSaveStatus = ref({ show: false, success: false, message: '' });
        
        const showDiscordTicketArchive = ref(false);
        const discordTicketArchiveHtml = ref('');
        const mobileMenuOpen = ref(false);
        const newTeam = ref({ name: '', logoFile: null });
        const managerForm = ref({});
        let calendar = null;

        const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
        const loginError = ref('');

        // Expose to window for Google Callback
        window.handleGoogleLogin = async (response) => {
            try {
                const res = await fetch(`${API_URL}/auth/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: response.credential })
                });
                if (!res.ok) {
                    const err = await res.json();
                    loginError.value = err.detail || 'Erreur de connexion';
                    return;
                }
                const data = await res.json();
                localStorage.setItem('token', data.access_token);
                document.cookie = `token=${data.access_token}; max-age=315360000; path=/`;
                await fetchUser();
            } catch (e) {
                loginError.value = 'Erreur de connexion au serveur';
            }
        };

        const logout = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('admin_impersonator_token');
            localStorage.removeItem('impersonated_user_email');
            document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            user.value = null;
            window.location.reload();
        };

        const fetchUser = async () => {
            if (!localStorage.getItem('token')) return;
            try {
                const res = await fetch(`${API_URL}/users/me`, { headers: authHeader() });
                if (res.ok) {
                    user.value = await res.json();
                    if (user.value.is_manager) fetchManagerData();
                    if (user.value.is_admin) {
                        if (typeof fetchTeams === 'function') fetchTeams();
                        if (typeof fetchUsers === 'function') fetchUsers();
                    }
                    if (currentTab.value === 'planning') setTimeout(initCalendar, 100);
                    if (currentTab.value === 'discord') handleDiscordTab('discord');
                } else {
                    if (localStorage.getItem('admin_impersonator_token')) {
                        stopImpersonating();
                    } else {
                        logout();
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };

        const fetchManagerData = async () => {
            try {
                const teamRes = await fetch(`${API_URL}/teams/my-team`, { headers: authHeader() });
                if(teamRes.ok) myTeam.value = await teamRes.json();

                const membersRes = await fetch(`${API_URL}/teams/members`, { headers: authHeader() });
                if(membersRes.ok) teamMembers.value = await membersRes.json();

                const shiftRes = await fetch(`${API_URL}/teams/shift-types`, { headers: authHeader() });
                if(shiftRes.ok) shiftTypes.value = await shiftRes.json();
            } catch (e) {
                console.error(e);
            }
        };

        const handleMyTeamLogoUpload = (e) => {
            myTeam.value.logoFile = e.target.files[0];
        };

        const updateMyTeam = async () => {
            try {
                let logoUrl = myTeam.value.logo;
                if (myTeam.value.logoFile) {
                    const fd = new FormData();
                    fd.append("file", myTeam.value.logoFile);
                    const uploadRes = await fetch(`${API_URL}/upload`, {
                        method: 'POST',
                        body: fd
                    });
                    if (uploadRes.ok) {
                        const data = await uploadRes.json();
                        logoUrl = data.url;
                    }
                }

                const res = await fetch(`${API_URL}/teams/my-team`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({ name: myTeam.value.name, logo: logoUrl, address: myTeam.value.address })
                });
                if(res.ok) {
                    alert('Équipe mise à jour !');
                    fetchManagerData();
                } else {
                    alert('Erreur lors de la mise à jour');
                }
            } catch(e) { console.error(e); }
        };

        const fetchEvents = async () => {
            if (!user.value) return;
            try {
                const res = await fetch(`${API_URL}/events/`, { headers: authHeader() });
                if (res.ok) {
                    events.value = await res.json();
                    if (calendar) {
                        calendar.removeAllEvents();
                        const groups = {};
                        events.value.forEach(e => {
                            const key = `${e.shift_type_id}-${e.start_time}-${e.end_time}`;
                            if (!groups[key]) groups[key] = { ...e, users: [], event_ids: [] };
                            groups[key].users.push(e.user);
                            groups[key].event_ids.push(e.id);
                        });

                        const formattedEvents = Object.values(groups).map(g => {
                            let title = g.shift_type.name;
                            if (user.value && user.value.is_manager) {
                                const names = g.users.map(u => u.first_name || 'Inconnu');
                                const namesStr = names.length > 1 ? names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1] : names[0];
                                title = `${title} ${namesStr}`;
                            }
                            return {
                                id: g.event_ids.join(','),
                                title: title,
                                start: g.start_time,
                                end: g.end_time,
                                color: g.shift_type.color,
                                extendedProps: { 
                                    eventIds: g.event_ids.join(','),
                                    userIds: g.users.map(u => u.id),
                                    shiftTypeId: g.shift_type_id
                                }
                            };
                        });
                        calendar.addEventSource(formattedEvents);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };

        const inviteUser = async () => {
            try {
                const res = await fetch(`${API_URL}/teams/add-member`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({ email: inviteEmail.value })
                });
                if (res.ok) {
                    alert('Membre ajouté avec succès ! Un email a été envoyé.');
                    inviteEmail.value = '';
                    fetchManagerData();
                } else {
                    alert('Erreur');
                }
            } catch(e) { console.error(e); }
        };

        const removeMember = async (memberId) => {
            if(!confirm("Voulez-vous vraiment retirer ce membre de votre équipe ? Ses créneaux seront supprimés.")) return;
            try {
                const res = await fetch(`${API_URL}/teams/${myTeam.value.id}/members/${memberId}`, {
                    method: 'DELETE',
                    headers: authHeader()
                });
                if (res.ok) {
                    fetchManagerData();
                } else {
                    alert('Erreur lors de la suppression');
                }
            } catch(e) { console.error(e); }
        };

        const addShiftType = async () => {
            try {
                const res = await fetch(`${API_URL}/teams/shift-types`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify(shiftTypeForm.value)
                });
                if (res.ok) {
                    shiftTypes.value.push(await res.json());
                    shiftTypeForm.value = { name: '', color: '#3788d8' };
                }
            } catch(e) { console.error(e); }
        };

        const addEvent = async () => {
            try {
                if (eventForm.value.editingEventIds) {
                    await fetch(`${API_URL}/events/?ids=${eventForm.value.editingEventIds}`, {
                        method: 'DELETE',
                        headers: authHeader()
                    });
                }
                const res = await fetch(`${API_URL}/events/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({
                        user_ids: eventForm.value.user_ids,
                        shift_type_id: eventForm.value.shift_type_id,
                        start_time: eventForm.value.start_time,
                        end_time: eventForm.value.end_time
                    })
                });
                if (res.ok) {
                    fetchEvents();
                    eventForm.value.start_time = '';
                    eventForm.value.end_time = '';
                    eventForm.value.editingEventIds = null;
                    showEventModal.value = false;
                } else {
                    alert("Erreur lors de l'ajout");
                }
            } catch(e) { console.error(e); }
        };

        const initCalendar = () => {
            const calendarEl = document.getElementById('calendar');
            if (!calendarEl) return;
            
            const isManager = Boolean(user.value && user.value.is_manager);
            const isMobile = window.innerWidth < 768;
            // Touch devices (phones/tablets): the empty grid must ONLY scroll, never create a slot
            const isTouch = isMobile || window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
            const canClickToCreate = isManager && !isTouch;
            
            if (calendar) {
                calendar.setOption('editable', isManager);
                calendar.setOption('selectable', canClickToCreate);
                calendar.render();
                return;
            }

            const gridCreationHandlers = isTouch ? {} : {
                dateClick: (info) => {
                    if (user.value && user.value.is_manager) {
                        eventForm.value.editingEventIds = null;
                        const start = info.dateStr.includes('T') ? info.dateStr.slice(0, 16) : `${info.dateStr}T09:00`;
                        const startDate = new Date(start);
                        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
                        const pad = n => n < 10 ? '0' + n : n;
                        const end = `${endDate.getFullYear()}-${pad(endDate.getMonth()+1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
                        openCreateEventModal(start, end);
                    }
                },
                select: (info) => {
                    if (user.value && user.value.is_manager) {
                        openCreateEventModal(info.startStr.slice(0, 16), info.endStr.slice(0, 16));
                        calendar.unselect();
                    }
                }
            };
            
            calendar = new FullCalendar.Calendar(calendarEl, {
                ...gridCreationHandlers,
                initialView: 'timeGridThreeDay',
                views: {
                    timeGridThreeDay: {
                        type: 'timeGrid',
                        duration: { days: 3 },
                        buttonText: '3 jours'
                    }
                },
                headerToolbar: isMobile ? {
                    left: 'prev,today,next',
                    center: 'title',
                    right: 'timeGridDay,timeGridThreeDay,timeGridWeek,dayGridMonth'
                } : {
                    left: 'prev,today,next',
                    center: 'title',
                    right: 'timeGridDay,timeGridThreeDay,timeGridWeek,dayGridMonth'
                },
                dayHeaderFormat: isMobile 
                    ? { weekday: 'short', day: 'numeric', month: 'numeric' }
                    : { weekday: 'short', day: 'numeric', month: 'numeric', omitCommas: true },
                titleFormat: isMobile
                    ? { month: 'short', year: 'numeric', day: 'numeric' }
                    : { month: 'long', year: 'numeric' },
                buttonText: {
                    today: "Aujourd'hui",
                    month: "Mois",
                    week: "Semaine",
                    day: "Jour"
                },
                locale: 'fr',
                firstDay: 1, // Start week on Monday
                allDaySlot: false,
                scrollTime: '07:00:00',
                // Mobile: 1h rows so ~7h→19h fit on screen without scrolling
                slotDuration: isMobile ? '01:00:00' : '00:30:00',
                slotLabelInterval: '01:00',
                snapDuration: '00:15:00',
                slotEventOverlap: true,
                eventOverlap: true,
                nowIndicator: true,
                events: [],
                editable: isManager,
                selectable: canClickToCreate,
                eventLongPressDelay: 400,
                selectLongPressDelay: 100000,
                eventDrop: async (info) => {
                    if (user.value && user.value.is_manager) {
                        try {
                            const eventIds = info.event.extendedProps.eventIds;
                            await fetch(`${API_URL}/events/?ids=${eventIds}`, { method: 'DELETE', headers: authHeader() });
                            await fetch(`${API_URL}/events/`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...authHeader() },
                                body: JSON.stringify({
                                    user_ids: info.event.extendedProps.userIds,
                                    shift_type_id: info.event.extendedProps.shiftTypeId,
                                    start_time: info.event.startStr.slice(0, 19),
                                    end_time: info.event.endStr ? info.event.endStr.slice(0, 19) : info.event.startStr.slice(0, 19)
                                })
                            });
                            fetchEvents();
                        } catch (e) { info.revert(); }
                    }
                },
                eventResize: async (info) => {
                    if (user.value && user.value.is_manager) {
                        try {
                            const eventIds = info.event.extendedProps.eventIds;
                            await fetch(`${API_URL}/events/?ids=${eventIds}`, { method: 'DELETE', headers: authHeader() });
                            await fetch(`${API_URL}/events/`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...authHeader() },
                                body: JSON.stringify({
                                    user_ids: info.event.extendedProps.userIds,
                                    shift_type_id: info.event.extendedProps.shiftTypeId,
                                    start_time: info.event.startStr.slice(0, 19),
                                    end_time: info.event.endStr ? info.event.endStr.slice(0, 19) : info.event.startStr.slice(0, 19)
                                })
                            });
                            fetchEvents();
                        } catch (e) { info.revert(); }
                    }
                },
                eventClick: (info) => {
                    if (user.value && user.value.is_manager) {
                        const margin = 120;
                        const x = Math.min(Math.max(info.jsEvent.clientX, margin), window.innerWidth - margin);
                        const y = Math.max(info.jsEvent.clientY, 90);
                        eventPopover.value = {
                            show: true,
                            x,
                            y,
                            eventInfo: info
                        };
                    }
                }
            });
            calendar.render();
            fetchEvents();

            // Swipe navigation for mobile
            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            let isTouchingEvent = false;

            calendarEl.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    touchStartTime = Date.now();
                    isTouchingEvent = Boolean(e.target.closest('.fc-event'));
                }
            }, { passive: true });

            calendarEl.addEventListener('touchend', (e) => {
                if (!isTouchingEvent && e.changedTouches.length === 1) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const deltaX = touchEndX - touchStartX;
                    const deltaY = touchEndY - touchStartY;
                    const duration = Date.now() - touchStartTime;

                    // Detect horizontal swipe: distance > 50px, predominantly horizontal, and fast enough
                    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && duration < 600) {
                        const viewEl = calendarEl.querySelector('.fc-view-harness');
                        if (deltaX < 0) {
                            // Swiped left -> Next
                            calendar.next();
                            if (viewEl) {
                                viewEl.classList.remove('anim-slide-left', 'anim-slide-right');
                                void viewEl.offsetWidth; // force reflow
                                viewEl.classList.add('anim-slide-left');
                            }
                        } else {
                            // Swiped right -> Previous
                            calendar.prev();
                            if (viewEl) {
                                viewEl.classList.remove('anim-slide-left', 'anim-slide-right');
                                void viewEl.offsetWidth; // force reflow
                                viewEl.classList.add('anim-slide-right');
                            }
                        }
                    }
                }
            }, { passive: true });
        };

        const fetchTeams = async () => {
            try {
                const res = await fetch(`${API_URL}/teams/`, { headers: authHeader() });
                if (res.ok) {
                    const teamsData = await res.json();
                    // Fetch managers for each team
                    for (let team of teamsData) {
                        const mRes = await fetch(`${API_URL}/teams/${team.id}/managers`, { headers: authHeader() });
                        if (mRes.ok) {
                            team.managers = await mRes.json();
                        } else {
                            team.managers = [];
                        }
                    }
                    allTeams.value = teamsData;
                }
            } catch(e) { console.error(e); }
        };

        const deleteTeam = async (team) => {
            const userInput = prompt(`Pour confirmer la suppression de l'équipe et de TOUTES ses données (membres, créneaux, etc.), veuillez taper exactement : ${team.name}`);
            if (userInput !== team.name) {
                if (userInput !== null) alert("Le nom saisi ne correspond pas. Annulation.");
                return;
            }
            try {
                const res = await fetch(`${API_URL}/teams/${team.id}`, {
                    method: 'DELETE',
                    headers: authHeader()
                });
                if (res.ok) {
                    alert("L'équipe a bien été supprimée.");
                    fetchTeams();
                } else {
                    alert('Erreur lors de la suppression de l\'équipe');
                }
            } catch(e) { console.error(e); }
        };

        const removeManager = async (teamId, userId) => {
            if(!confirm("Êtes-vous sûr de vouloir retirer ce gestionnaire ?")) return;
            try {
                const res = await fetch(`${API_URL}/teams/${teamId}/managers/${userId}`, {
                    method: 'DELETE',
                    headers: authHeader()
                });
                if (res.ok) {
                    fetchTeams();
                } else {
                    alert('Erreur lors de la suppression');
                }
            } catch(e) { console.error(e); }
        };

        const handleFileUpload = (e) => {
            newTeam.value.logoFile = e.target.files[0];
        };

        const createTeam = async () => {
            try {
                let logoUrl = null;
                if (newTeam.value.logoFile) {
                    const fd = new FormData();
                    fd.append("file", newTeam.value.logoFile);
                    const uploadRes = await fetch(`${API_URL}/upload`, {
                        method: 'POST',
                        body: fd
                    });
                    if (uploadRes.ok) {
                        const data = await uploadRes.json();
                        logoUrl = data.url;
                    }
                }

                const res = await fetch(`${API_URL}/teams/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({ name: newTeam.value.name, logo: logoUrl })
                });
                if(res.ok) {
                    alert('Equipe créée !');
                    newTeam.value = { name: '', logoFile: null };
                    // Reset file input
                    const fileInput = document.getElementById('logoUpload');
                    if (fileInput) fileInput.value = '';
                    fetchTeams();
                } else {
                    alert('Erreur lors de la création de l\'équipe');
                }
            } catch(e) { console.error(e); }
        };

        const addManager = async (teamId) => {
            try {
                const email = managerForm.value[teamId];
                if (!email) return;

                const res = await fetch(`${API_URL}/teams/${teamId}/add-manager`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({ email: email })
                });
                if(res.ok) {
                    alert('Gestionnaire ajouté ! Un email lui a été envoyé.');
                    managerForm.value[teamId] = '';
                    fetchTeams();
                } else {
                    alert('Erreur lors de l\'ajout du gestionnaire');
                }
            } catch(e) { console.error(e); }
        };

        // User Management Methods (Admin)
        const fetchUsers = async () => {
            try {
                const res = await fetch(`${API_URL}/users/`, { headers: authHeader() });
                if (res.ok) {
                    allUsers.value = await res.json();
                }
            } catch (e) {
                console.error(e);
            }
        };

        const filteredUsers = computed(() => {
            let list = allUsers.value;
            if (userSearch.value.trim()) {
                const q = userSearch.value.trim().toLowerCase();
                list = list.filter(u => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
                    const email = (u.email || '').toLowerCase();
                    const team = (u.team_name || '').toLowerCase();
                    return fullName.includes(q) || email.includes(q) || team.includes(q);
                });
            }
            if (userFilterTeam.value) {
                if (userFilterTeam.value === 'none') {
                    list = list.filter(u => !u.team_id);
                } else {
                    list = list.filter(u => u.team_id == userFilterTeam.value);
                }
            }
            if (userFilterStatus.value) {
                if (userFilterStatus.value === 'active') {
                    list = list.filter(u => !u.is_blocked);
                } else if (userFilterStatus.value === 'blocked') {
                    list = list.filter(u => u.is_blocked);
                }
            }
            return list;
        });

        const toggleBlockUser = async (targetUser) => {
            if (user.value && targetUser.id === user.value.id) {
                alert("Vous ne pouvez pas bloquer votre propre compte administrateur.");
                return;
            }
            const actionText = targetUser.is_blocked ? "débloquer" : "bloquer";
            if (!confirm(`Êtes-vous sûr de vouloir ${actionText} l'utilisateur ${targetUser.email} ?`)) return;
            try {
                const res = await fetch(`${API_URL}/users/${targetUser.id}/toggle-block`, {
                    method: 'PUT',
                    headers: authHeader()
                });
                if (res.ok) {
                    const updated = await res.json();
                    targetUser.is_blocked = updated.is_blocked;
                    targetUser.token_version = updated.token_version;
                    alert(`Utilisateur ${targetUser.email} ${updated.is_blocked ? 'bloqué' : 'débloqué'} avec succès.`);
                } else {
                    const err = await res.json();
                    alert(err.detail || "Erreur lors de la mise à jour du statut.");
                }
            } catch (e) {
                console.error(e);
                alert("Erreur de communication avec le serveur.");
            }
        };

        const disconnectUser = async (targetUser) => {
            if (!confirm(`Forcer la déconnexion de ${targetUser.email} ? Toutes ses sessions actives seront invalidées immédiatement.`)) return;
            try {
                const res = await fetch(`${API_URL}/users/${targetUser.id}/disconnect`, {
                    method: 'POST',
                    headers: authHeader()
                });
                if (res.ok) {
                    const data = await res.json();
                    alert(data.message || "Utilisateur déconnecté avec succès.");
                    fetchUsers();
                } else {
                    const err = await res.json();
                    alert(err.detail || "Erreur lors de la déconnexion forcée.");
                }
            } catch (e) {
                console.error(e);
                alert("Erreur de communication avec le serveur.");
            }
        };

        const openRoleModal = (targetUser) => {
            roleModalUser.value = targetUser;
            roleModalForm.value = {
                discord_role: targetUser.discord_role ? 1 : 0
            };
            showRoleModal.value = true;
        };

        const saveUserRoles = async () => {
            if (!roleModalUser.value) return;
            try {
                const res = await fetch(`${API_URL}/users/${roleModalUser.value.id}/roles`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({
                        discord_role: Number(roleModalForm.value.discord_role)
                    })
                });
                if (res.ok) {
                    const updated = await res.json();
                    roleModalUser.value.discord_role = updated.discord_role;
                    showRoleModal.value = false;
                    fetchUsers();
                } else {
                    const err = await res.json();
                    alert(err.detail || "Erreur lors de la mise à jour des rôles.");
                }
            } catch (e) {
                console.error(e);
                alert("Erreur serveur.");
            }
        };

        const promptDeleteUser = (targetUser) => {
            if (user.value && targetUser.id === user.value.id) {
                alert("Vous ne pouvez pas supprimer votre propre compte.");
                return;
            }
            deleteUserTarget.value = targetUser;
            showDeleteUserModal.value = true;
        };

        const executeDeleteUser = async () => {
            if (!deleteUserTarget.value) return;
            try {
                const res = await fetch(`${API_URL}/users/${deleteUserTarget.value.id}`, {
                    method: 'DELETE',
                    headers: authHeader()
                });
                if (res.ok) {
                    allUsers.value = allUsers.value.filter(u => u.id !== deleteUserTarget.value.id);
                    showDeleteUserModal.value = false;
                    deleteUserTarget.value = null;
                    alert("Utilisateur supprimé totalement avec succès.");
                } else {
                    const err = await res.json();
                    alert(err.detail || "Erreur lors de la suppression.");
                }
            } catch (e) {
                console.error(e);
                alert("Erreur serveur.");
            }
        };

        const impersonateUser = async (targetUser) => {
            if (targetUser.is_blocked) {
                alert("Impossible de se connecter à la place d'un utilisateur bloqué.");
                return;
            }
            if (user.value && targetUser.id === user.value.id) {
                alert("Vous êtes déjà connecté avec ce compte.");
                return;
            }
            if (!confirm(`Se connecter en tant que ${targetUser.email} ? Vous verrez l'application exactement comme cet utilisateur.`)) return;
            try {
                const res = await fetch(`${API_URL}/users/${targetUser.id}/impersonate`, {
                    method: 'POST',
                    headers: authHeader()
                });
                if (res.ok) {
                    const data = await res.json();
                    const adminToken = localStorage.getItem('token');
                    localStorage.setItem('admin_impersonator_token', adminToken);
                    localStorage.setItem('impersonated_user_email', targetUser.email);
                    localStorage.setItem('token', data.access_token);
                    document.cookie = `token=${data.access_token}; max-age=315360000; path=/`;
                    localStorage.setItem('currentTab', 'planning');
                    window.location.reload();
                } else {
                    const err = await res.json();
                    alert(err.detail || "Erreur lors de l'emprunt d'identité.");
                }
            } catch (e) {
                console.error(e);
                alert("Erreur de connexion.");
            }
        };

        const stopImpersonating = () => {
            const adminToken = localStorage.getItem('admin_impersonator_token');
            if (adminToken) {
                localStorage.setItem('token', adminToken);
                document.cookie = `token=${adminToken}; max-age=315360000; path=/`;
                localStorage.removeItem('admin_impersonator_token');
                localStorage.removeItem('impersonated_user_email');
                localStorage.setItem('currentTab', 'admin');
                localStorage.setItem('adminSubTab', 'utilisateurs');
                window.location.reload();
            } else {
                logout();
            }
        };

        const openCreateEventModal = (startTime = null, endTime = null) => {
            if (!user.value || !user.value.is_manager) return;
            eventForm.value.editingEventIds = null;
            eventForm.value.user_ids = [];
            if (startTime) {
                eventForm.value.start_time = startTime;
                eventForm.value.end_time = endTime || startTime;
            } else {
                const now = new Date();
                const pad = n => n < 10 ? '0' + n : n;
                const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
                eventForm.value.start_time = `${todayStr}T08:00`;
                eventForm.value.end_time = `${todayStr}T12:00`;
            }
            if (!eventForm.value.shift_type_id && shiftTypes.value && shiftTypes.value.length > 0) {
                eventForm.value.shift_type_id = shiftTypes.value[0].id;
            }
            if (eventPopover.value) eventPopover.value.show = false;
            showEventModal.value = true;
        };

        const addEventOnSameSlot = () => {
            if (!user.value || !user.value.is_manager) return;
            const info = eventPopover.value.eventInfo;
            if (!info) return;
            const start = info.event.startStr.slice(0, 16);
            const end = info.event.endStr ? info.event.endStr.slice(0, 16) : start;
            openCreateEventModal(start, end);
        };

        const editEvent = () => {
            if (!user.value || !user.value.is_manager) return;
            const info = eventPopover.value.eventInfo;
            eventForm.value.editingEventIds = info.event.extendedProps.eventIds;
            eventForm.value.shift_type_id = info.event.extendedProps.shiftTypeId;
            eventForm.value.user_ids = info.event.extendedProps.userIds;
            eventForm.value.start_time = info.event.startStr.slice(0, 16);
            eventForm.value.end_time = info.event.endStr ? info.event.endStr.slice(0, 16) : info.event.startStr.slice(0, 16);
            eventPopover.value.show = false;
            showEventModal.value = true;
        };

        const deleteEvent = async () => {
            if (!user.value || !user.value.is_manager) return;
            const info = eventPopover.value.eventInfo;
            if (confirm(`Voulez-vous supprimer ce créneau "${info.event.title}" ?`)) {
                try {
                    const res = await fetch(`${API_URL}/events/?ids=${info.event.extendedProps.eventIds}`, {
                        method: 'DELETE',
                        headers: authHeader()
                    });
                    if (res.ok) fetchEvents();
                    else alert("Erreur lors de la suppression");
                } catch (e) { console.error(e); }
            }
            eventPopover.value.show = false;
        };

        // Discord Methods
        const loadDiscordData = async () => {
            if (!user.value || user.value.discord_role !== 1) return;
            try {
                const token = localStorage.getItem('token');
                const headers = { 'Authorization': `Bearer ${token}` };
                
                const statsRes = await fetch(`${API_URL}/discord/stats`, { headers });
                if (statsRes.ok) discordStats.value = await statsRes.json();
                
                const panelsRes = await fetch(`${API_URL}/discord/panels`, { headers });
                if (panelsRes.ok) discordPanels.value = await panelsRes.json();
                
                const ticketsRes = await fetch(`${API_URL}/discord/tickets`, { headers });
                if (ticketsRes.ok) discordTickets.value = await ticketsRes.json();
                
                const channelsRes = await fetch(`${API_URL}/discord/channels`, { headers });
                if (channelsRes.ok) discordChannels.value = await channelsRes.json();

                fetchBotProfile();
            } catch (err) {
                console.error("Error loading Discord data:", err);
            }
        };

        const fetchBotProfile = async () => {
            if (!user.value || user.value.discord_role !== 1) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/discord/bot/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    discordBotProfile.value.id = data.id || '';
                    discordBotProfile.value.username = data.username || '';
                    discordBotProfile.value.avatar_url = data.avatar_url || '';
                }
            } catch (e) {
                console.error("Error fetching bot profile:", e);
            }
        };

        const handleBotAvatarChange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (file.size > 8 * 1024 * 1024) {
                alert("L'image sélectionnée est trop volumineuse (maximum 8 Mo).");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                discordBotProfile.value.avatar_preview = event.target.result;
            };
            reader.readAsDataURL(file);
        };

        const cancelBotAvatarPreview = () => {
            discordBotProfile.value.avatar_preview = null;
            const input = document.getElementById('botAvatarUpload');
            if (input) input.value = '';
        };

        const triggerBotAvatarUpload = () => {
            const el = document.getElementById('botAvatarUpload');
            if (el) el.click();
        };

        const saveBotProfile = async () => {
            if (isSavingBotProfile.value) return;
            try {
                isSavingBotProfile.value = true;
                botProfileSaveStatus.value = { show: false, success: false, message: '' };
                const token = localStorage.getItem('token');
                const payload = {
                    username: discordBotProfile.value.username,
                    avatar_base64: discordBotProfile.value.avatar_preview || null
                };
                const res = await fetch(`${API_URL}/discord/bot/profile`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    if (data.avatar_url) {
                        discordBotProfile.value.avatar_url = data.avatar_url;
                    }
                    if (data.username) {
                        discordBotProfile.value.username = data.username;
                    }
                    discordBotProfile.value.avatar_preview = null;
                    const input = document.getElementById('botAvatarUpload');
                    if (input) input.value = '';

                    botProfileSaveStatus.value = {
                        show: true,
                        success: true,
                        message: data.message || "Profil du bot Discord mis à jour avec succès !"
                    };
                    setTimeout(() => {
                        botProfileSaveStatus.value.show = false;
                    }, 5000);
                } else {
                    botProfileSaveStatus.value = {
                        show: true,
                        success: false,
                        message: data.detail || "Erreur lors de la mise à jour du profil du bot."
                    };
                }
            } catch (err) {
                console.error("Erreur saveBotProfile:", err);
                botProfileSaveStatus.value = {
                    show: true,
                    success: false,
                    message: "Erreur de connexion au serveur."
                };
            } finally {
                isSavingBotProfile.value = false;
            }
        };

        let discordRefreshInterval = null;
        function handleDiscordTab(newTab) {
            if (discordRefreshInterval) {
                clearInterval(discordRefreshInterval);
                discordRefreshInterval = null;
            }
            if (newTab === 'discord' && user.value && user.value.discord_role === 1) {
                loadDiscordData();
                discordRefreshInterval = setInterval(() => {
                    if (user.value && user.value.discord_role === 1) {
                        const token = localStorage.getItem('token');
                        if (!token) return;
                        fetch(`${API_URL}/discord/tickets`, { headers: { 'Authorization': `Bearer ${token}` } })
                            .then(res => res.ok ? res.json() : Promise.reject())
                            .then(data => discordTickets.value = data)
                            .catch(() => {});
                    }
                }, 15000); // 15 secondes
            }
        };

        watch(currentTab, handleDiscordTab);

        const openCreateDiscordPanel = () => {
            discordPanelForm.value = {
                id: null,
                name: '',
                embed_title: 'Système de Ticket',
                embed_description: 'Cliquez sur le bouton ci-dessous pour ouvrir un ticket.',
                embed_color: '#3B82F6',
                button_text: 'Ouvrir un ticket',
                button_emoji: '🎫',
                button_color: 'primary',
                active_category_id: '',
                archive_category_id: '',
                ping_role_id: '',
                ping_creator: true,
                max_tickets_per_user: 1,
                intro_message: 'Veuillez patienter, un membre du staff va vous répondre.',
                inactivity_days: 3,
                close_button_text: 'Fermer le ticket',
                close_button_color: 'danger',
                close_button_emoji: '🔒',
                reopen_button_text: 'Ré-ouvrir',
                reopen_button_color: 'success',
                reopen_button_emoji: '🔓',
                delete_button_text: 'Supprimer',
                delete_button_color: 'danger',
                delete_button_emoji: '🗑️'
            };
            showDiscordPanelModal.value = true;
        };

        const openEditDiscordPanel = (panel) => {
            discordPanelForm.value = {
                id: panel.id,
                name: panel.name || '',
                embed_title: panel.embed_title || '',
                embed_description: panel.embed_description || '',
                embed_color: panel.embed_color || '#3B82F6',
                button_text: panel.button_text || '',
                button_emoji: panel.button_emoji || '',
                button_color: panel.button_color || 'primary',
                active_category_id: panel.active_category_id ? String(panel.active_category_id) : '',
                archive_category_id: panel.archive_category_id ? String(panel.archive_category_id) : '',
                ping_role_id: panel.ping_role_id ? String(panel.ping_role_id) : '',
                ping_creator: panel.ping_creator !== undefined ? panel.ping_creator : true,
                max_tickets_per_user: panel.max_tickets_per_user || 1,
                intro_message: panel.intro_message || '',
                inactivity_days: panel.inactivity_days || 3,
                deployed_channel_id: panel.deployed_channel_id || null,
                deployed_message_id: panel.deployed_message_id || null,
                close_button_text: panel.close_button_text || 'Fermer le ticket',
                close_button_color: panel.close_button_color || 'danger',
                close_button_emoji: panel.close_button_emoji || '🔒',
                reopen_button_text: panel.reopen_button_text || 'Ré-ouvrir',
                reopen_button_color: panel.reopen_button_color || 'success',
                reopen_button_emoji: panel.reopen_button_emoji || '🔓',
                delete_button_text: panel.delete_button_text || 'Supprimer',
                delete_button_color: panel.delete_button_color || 'danger',
                delete_button_emoji: panel.delete_button_emoji || '🗑️'
            };
            showDiscordPanelModal.value = true;
        };

        const saveDiscordPanel = async () => {
            try {
                const token = localStorage.getItem('token');
                const method = discordPanelForm.value.id ? 'PUT' : 'POST';
                const url = discordPanelForm.value.id 
                    ? `${API_URL}/discord/panels/${discordPanelForm.value.id}` 
                    : `${API_URL}/discord/panels`;
                
                const payload = {
                    name: discordPanelForm.value.name,
                    embed_title: discordPanelForm.value.embed_title,
                    embed_description: discordPanelForm.value.embed_description,
                    embed_color: discordPanelForm.value.embed_color,
                    button_text: discordPanelForm.value.button_text,
                    button_emoji: discordPanelForm.value.button_emoji,
                    button_color: discordPanelForm.value.button_color,
                    active_category_id: discordPanelForm.value.active_category_id || null,
                    archive_category_id: discordPanelForm.value.archive_category_id || null,
                    ping_role_id: discordPanelForm.value.ping_role_id || null,
                    ping_creator: discordPanelForm.value.ping_creator,
                    max_tickets_per_user: parseInt(discordPanelForm.value.max_tickets_per_user) || 1,
                    intro_message: discordPanelForm.value.intro_message,
                    inactivity_days: parseInt(discordPanelForm.value.inactivity_days) || 3,
                    close_button_text: discordPanelForm.value.close_button_text,
                    close_button_color: discordPanelForm.value.close_button_color,
                    close_button_emoji: discordPanelForm.value.close_button_emoji,
                    reopen_button_text: discordPanelForm.value.reopen_button_text,
                    reopen_button_color: discordPanelForm.value.reopen_button_color,
                    reopen_button_emoji: discordPanelForm.value.reopen_button_emoji,
                    delete_button_text: discordPanelForm.value.delete_button_text,
                    delete_button_color: discordPanelForm.value.delete_button_color,
                    delete_button_emoji: discordPanelForm.value.delete_button_emoji,
                };
                
                const res = await fetch(url, {
                    method,
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    showDiscordPanelModal.value = false;
                    loadDiscordData();
                    if (discordPanelForm.value.id && discordPanelForm.value.deployed_channel_id) {
                        alert("Panel mis à jour et redéployé automatiquement sur Discord !");
                    } else {
                        alert("Panel sauvegardé avec succès !");
                    }
                } else {
                    const err = await res.json().catch(() => ({}));
                    alert("Erreur lors de la sauvegarde du panel : " + (err.detail || "Vérifiez vos champs"));
                }
            } catch (err) {
                console.error(err);
                alert("Erreur réseau");
            }
        };

        const deleteDiscordPanel = async (id) => {
            if(!confirm("Supprimer ce panel (et ses questions) ?")) return;
            try {
                const res = await fetch(`${API_URL}/discord/panels/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) loadDiscordData();
            } catch(e) {}
        };
        
        const openDeployModal = (panel) => {
            discordDeployForm.value = { panel_id: panel.id, channel_id: '' };
            showDiscordDeployModal.value = true;
        };

        const executeDiscordDeploy = async () => {
            if (!discordDeployForm.value.channel_id) return;
            try {
                const res = await fetch(`${API_URL}/discord/panels/${discordDeployForm.value.panel_id}/send?channel_id=${discordDeployForm.value.channel_id}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    alert("Bouton déployé avec succès sur Discord !");
                    showDiscordDeployModal.value = false;
                }
                else alert("Erreur d'envoi");
            } catch(e) {}
        };
        
        const openFieldsManager = async (panel) => {
            currentFieldPanelId.value = panel.id;
            try {
                const res = await fetch(`${API_URL}/discord/panels/${panel.id}/fields`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    discordFields.value = await res.json();
                    showDiscordFieldsModal.value = true;
                }
            } catch(e) {}
        };
        
        const saveDiscordField = async () => {
            if (discordFields.value.length >= 5 && !discordFieldForm.value.id) {
                alert("Discord limite les formulaires à 5 questions maximum.");
                return;
            }
            try {
                const method = discordFieldForm.value.id ? 'PUT' : 'POST';
                const url = discordFieldForm.value.id 
                    ? `${API_URL}/discord/fields/${discordFieldForm.value.id}` 
                    : `${API_URL}/discord/panels/${currentFieldPanelId.value}/fields`;
                
                const res = await fetch(url, {
                    method,
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        label: discordFieldForm.value.label,
                        is_paragraph: discordFieldForm.value.is_paragraph,
                        required: discordFieldForm.value.required,
                        order: discordFieldForm.value.order
                    })
                });
                if (res.ok) {
                    // refresh fields
                    const refRes = await fetch(`${API_URL}/discord/panels/${currentFieldPanelId.value}/fields`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (refRes.ok) discordFields.value = await refRes.json();
                    discordFieldForm.value = { id: null, label: '', is_paragraph: false, required: true, order: 0 };
                }
            } catch(e) {}
        };
        
        const deleteDiscordField = async (id) => {
            if(!confirm("Supprimer ce champ ?")) return;
            try {
                const res = await fetch(`${API_URL}/discord/fields/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    discordFields.value = discordFields.value.filter(f => f.id !== id);
                }
            } catch(e) {}
        };

        const closeDiscordTicket = async (id) => {
            if(!confirm("Fermer ce ticket ?")) return;
            try {
                const res = await fetch(`${API_URL}/discord/tickets/${id}/close`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    loadDiscordData();
                } else {
                    alert("Erreur lors de la fermeture du ticket");
                }
            } catch(e) {}
        };

        const openDiscordArchive = async (ticketId) => {
            try {
                const res = await fetch(`${API_URL}/discord/tickets/${ticketId}/archive`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    discordTicketArchiveHtml.value = data.html_content;
                    showDiscordTicketArchive.value = true;
                }
            } catch(e) {}
        };

        const filteredDiscordTickets = computed(() => {
            let filtered = [...discordTickets.value];
            if (discordSearch.value) {
                const s = discordSearch.value.toLowerCase();
                filtered = filtered.filter(t => 
                    (t.id && t.id.toString().includes(s)) || 
                    (t.creator_id && t.creator_id.toString().includes(s)) ||
                    (t.creator_username && t.creator_username.toLowerCase().includes(s)) ||
                    (t.status && t.status.toLowerCase().includes(s))
                );
            }
            if (discordDateFilter.value) {
                filtered = filtered.filter(t => t.created_at && t.created_at.startsWith(discordDateFilter.value));
            }
            
            filtered.sort((a, b) => {
                const dA = new Date(a.created_at || 0).getTime();
                const dB = new Date(b.created_at || 0).getTime();
                return discordSortDate.value === 'asc' ? dA - dB : dB - dA;
            });
            return filtered;
        });

        // 🚀 Infinite Scroll progressif côté front
        const displayedDiscordTickets = computed(() => {
            return filteredDiscordTickets.value.slice(0, visibleTicketsLimit.value);
        });

        const hasMoreTickets = computed(() => {
            return visibleTicketsLimit.value < filteredDiscordTickets.value.length;
        });

        const loadMoreTickets = () => {
            if (isLoadingMoreTickets.value || !hasMoreTickets.value) return;
            isLoadingMoreTickets.value = true;
            setTimeout(() => {
                visibleTicketsLimit.value += ticketsPageSize;
                isLoadingMoreTickets.value = false;
            }, 120);
        };

        let ticketsObserver = null;
        const initTicketsObserver = () => {
            if (ticketsObserver) {
                ticketsObserver.disconnect();
                ticketsObserver = null;
            }
            const sentinel = document.getElementById('tickets-infinite-sentinel');
            if (sentinel && window.IntersectionObserver) {
                ticketsObserver = new IntersectionObserver((entries) => {
                    const entry = entries[0];
                    if (entry && entry.isIntersecting && hasMoreTickets.value && !isLoadingMoreTickets.value) {
                        loadMoreTickets();
                    }
                }, {
                    root: null,
                    rootMargin: '250px',
                    threshold: 0.05
                });
                ticketsObserver.observe(sentinel);
            }
        };

        const handleWindowScroll = () => {
            if (currentTab.value === 'discord' && discordTab.value === 'tickets') {
                const scrollPos = window.innerHeight + window.scrollY;
                const docHeight = document.documentElement.scrollHeight;
                if (scrollPos >= docHeight - 350 && hasMoreTickets.value && !isLoadingMoreTickets.value) {
                    loadMoreTickets();
                }
            }
        };

        watch([discordSearch, discordDateFilter, discordSortDate], () => {
            visibleTicketsLimit.value = ticketsPageSize;
            setTimeout(initTicketsObserver, 50);
        });

        watch(discordTab, (tab) => {
            localStorage.setItem('discordTab', tab);
            if (tab === 'tickets') {
                setTimeout(initTicketsObserver, 150);
            }
        });

        watch(displayedDiscordTickets, () => {
            setTimeout(initTicketsObserver, 100);
        });

        onMounted(() => {
            fetchUser();
            window.addEventListener('scroll', handleWindowScroll, { passive: true });
            setTimeout(initTicketsObserver, 500);
        });

        return {
            user, currentTab, loginForm, eventForm, shiftTypeForm, inviteEmail, teamMembers, shiftTypes, apiUrl: API_URL, fullApiUrl: FULL_API_URL, loginError,
            newTeam, managerForm, allTeams, myTeam, showEventModal, eventPopover, mobileMenuOpen,
            logout, inviteUser, addShiftType, addEvent, createTeam, handleFileUpload, addManager, removeManager, deleteTeam,
            updateMyTeam, handleMyTeamLogoUpload, removeMember, editEvent, deleteEvent, openCreateEventModal, addEventOnSameSlot,
            discordTab, discordStats, discordPanels, discordTickets, discordChannels, discordSearch, discordDateFilter, discordSortDate, 
            showDiscordPanelModal, showDiscordPreviewModal, discordPanelForm, showDiscordTicketArchive, discordTicketArchiveHtml, 
            showDiscordFieldsModal, discordFields, currentFieldPanelId, discordFieldForm, showDiscordDeployModal, discordDeployForm,
            saveDiscordPanel, deleteDiscordPanel, openDeployModal, executeDiscordDeploy, openFieldsManager, saveDiscordField, deleteDiscordField,
            openCreateDiscordPanel, openEditDiscordPanel,
            openDiscordArchive, closeDiscordTicket, filteredDiscordTickets, loadDiscordData,
            displayedDiscordTickets, hasMoreTickets, loadMoreTickets, visibleTicketsLimit, isLoadingMoreTickets, ticketsPageSize,
            discordBotProfile, isSavingBotProfile, botProfileSaveStatus, fetchBotProfile, handleBotAvatarChange, cancelBotAvatarPreview, triggerBotAvatarUpload, saveBotProfile,
            adminSubTab, allUsers, userSearch, userFilterTeam, userFilterStatus, filteredUsers, isImpersonating, impersonatedEmail,
            showRoleModal, roleModalUser, roleModalForm, showDeleteUserModal, deleteUserTarget,
            fetchUsers, toggleBlockUser, disconnectUser, openRoleModal, saveUserRoles, promptDeleteUser, executeDeleteUser, impersonateUser, stopImpersonating
        };
    }
}).mount('#app');
