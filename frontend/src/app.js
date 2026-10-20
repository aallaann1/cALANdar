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
        const discordTab = ref(['tickets', 'announcements', 'panels'].includes(localStorage.getItem('discordTab')) ? localStorage.getItem('discordTab') : 'tickets');
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
        const discordPreviewTab = ref('panel'); // 'panel', 'ticket', 'closed', 'how_to_sell'
        const discordSettingsSubTab = ref(['panels', 'how_to_sell', 'logs', 'bot'].includes(localStorage.getItem('discordSettingsSubTab')) ? localStorage.getItem('discordSettingsSubTab') : 'panels'); // 'panels', 'how_to_sell', 'logs', 'bot'
        
        // Module Paramètres : Logs des Tickets Discord
        const discordLogsSettings = ref({
            logs_enabled: false,
            logs_channel_id: ''
        });
        const isSavingDiscordLogs = ref(false);
        const discordLogsStatus = ref({ show: false, success: true, message: '' });
        


        // Module Paramètres : Guide « Comment Vendre » (Embed dédié permanent)
        const howToSellForm = ref({
            id: null,
            key: 'how_to_sell',
            title: 'Comment vendre votre collection',
            channel_id: '',
            deployed_message_id: null,
            embed_title: '📖 Comment vendre votre collection ?',
            embed_title_url: '',
            embed_description: '',
            embed_color: '#5865F2',
            embed_author_name: '',
            embed_author_icon_url: '',
            embed_author_url: '',
            embed_thumbnail_url: '',
            embed_image_url: '',
            embed_footer_text: 'BRB Collection • Guide Officiel',
            embed_footer_icon_url: '',
            embed_show_timestamp: false,
            updated_at: null
        });
        const isSavingHowToSell = ref(false);
        const howToSellStatus = ref({ show: false, success: true, message: '' });

        // Module Annonces Discord
        const discordAnnouncements = ref([]);
        const showAnnouncementModal = ref(false);
        const isSavingAnnouncement = ref(false);
        const announcementStatus = ref({ show: false, success: true, message: '' });
        const lastSavedAnnouncementChannel = ref(localStorage.getItem('last_announcement_channel_id') || '');
        const currentDiscordTime = computed(() => {
            return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        const announcementForm = ref({
            id: null,
            title: '',
            channel_id: localStorage.getItem('last_announcement_channel_id') || '',
            content: '',
            enable_embed: true,
            embed_title: '',
            embed_title_url: '',
            embed_description: '',
            embed_color: '#5865F2',
            embed_author_name: '',
            embed_author_icon_url: '',
            embed_author_url: '',
            embed_thumbnail_url: '',
            embed_image_url: '',
            embed_footer_text: 'BRB Collection • Annonce',
            embed_footer_icon_url: '',
            embed_show_timestamp: true
        });

        const discordPanelForm = ref({ 
            id: null, name: '', modal_title: '',
            embed_title: '', embed_title_url: '', embed_description: '', embed_color: '#3B82F6',
            embed_author_name: '', embed_author_icon_url: '', embed_author_url: '',
            embed_thumbnail_url: '', embed_image_url: '',
            embed_footer_text: 'Système de Ticketing', embed_footer_icon_url: '', embed_show_timestamp: false,
            button_text: '', button_emoji: '', button_color: 'primary',
            active_category_id: '', archive_category_id: '', ping_role_id: '', 
            ping_creator: true, max_tickets_per_user: 1,
            intro_embed_title: 'Bienvenue dans votre ticket',
            intro_message: '',
            intro_embed_color: '',
            intro_thumbnail_url: '',
            intro_image_url: '',
            intro_footer_text: '',
            inactivity_days: 3,
            close_button_text: 'Fermer le ticket',
            close_button_color: 'danger',
            close_button_emoji: '🔒',
            close_reason_button_text: 'Fermer avec raison',
            close_reason_button_color: 'secondary',
            close_reason_button_emoji: '📝',
            reopen_button_text: 'Ré-ouvrir',
            reopen_button_color: 'success',
            reopen_button_emoji: '🔓',
            delete_button_text: 'Supprimer',
            delete_button_color: 'danger',
            delete_button_emoji: '🗑️',
            creator_can_close: true,
            creator_can_close_with_reason: false,
            dm_transcript_on_close: true,
            dm_embed_title: '🔒 Ticket fermé — {ticket_name}',
            dm_embed_title_url: '',
            dm_embed_description: 'Votre ticket **{ticket_name}** a été clôturé par **{closed_by}**.\nVous trouverez ci-joint l\'archive complète de votre conversation.',
            dm_embed_color: '',
            dm_thumbnail_url: '',
            dm_image_url: '',
            dm_footer_text: 'Téléchargez et ouvrez le fichier .html pour relire la conversation.',
            dm_footer_icon_url: '',
            dm_show_timestamp: true
        });
        const showDiscordFieldsModal = ref(false);
        const discordFields = ref([]);
        const currentFieldPanelId = ref(null);
        const currentFieldPanel = ref(null);
        const previewDropdownOpenIdx = ref(null);
        const getEmptyDiscordFieldForm = (nextOrder = 0) => ({
            id: null,
            label: '',
            field_type: 'short_text',
            is_paragraph: false,
            description: '',
            placeholder: '',
            required: true,
            min_length: null,
            max_length: null,
            default_value: '',
            options: [
                { label: '', value: '', description: '', emoji: '', default: false }
            ],
            min_values: 1,
            max_values: 1,
            order: nextOrder
        });
        const discordFieldForm = ref(getEmptyDiscordFieldForm(0));
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
                loadHowToSellSettings();
                loadDiscordLogsSettings();
                loadAnnouncements();
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

        watch(discordSettingsSubTab, (val) => {
            if (val) localStorage.setItem('discordSettingsSubTab', val);
        });

        const getDiscordChannelName = (chId) => {
            if (!chId) return '';
            for (const g of (discordChannels.value || [])) {
                const c = (g.channels || []).find(ch => String(ch.id) === String(chId));
                if (c) return c.name;
            }
            return chId;
        };



        // --- METHODES PARAMETRES : GUIDE « COMMENT VENDRE » (how_to_sell) ---
        const loadHowToSellSettings = async () => {
            if (!user.value || user.value.discord_role !== 1) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/discord/info-embeds/how_to_sell`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.key === 'how_to_sell') {
                        howToSellForm.value = {
                            ...howToSellForm.value,
                            ...data,
                            channel_id: data.channel_id ? String(data.channel_id) : ''
                        };
                    }
                }
            } catch (e) {
                console.error("Error loading how_to_sell settings:", e);
            }
        };

        const saveHowToSellSettings = async () => {
            if (!howToSellForm.value.channel_id) {
                alert("Veuillez sélectionner un salon Discord de destination pour le guide Comment Vendre.");
                return;
            }
            isSavingHowToSell.value = true;
            howToSellStatus.value.show = false;
            try {
                const token = localStorage.getItem('token');
                const payload = {
                    key: 'how_to_sell',
                    title: howToSellForm.value.title || 'Comment vendre votre collection',
                    channel_id: howToSellForm.value.channel_id ? String(howToSellForm.value.channel_id) : null,
                    embed_title: howToSellForm.value.embed_title || '',
                    embed_title_url: howToSellForm.value.embed_title_url || null,
                    embed_description: howToSellForm.value.embed_description || '',
                    embed_color: howToSellForm.value.embed_color || '#5865F2',
                    embed_author_name: howToSellForm.value.embed_author_name || null,
                    embed_author_icon_url: howToSellForm.value.embed_author_icon_url || null,
                    embed_author_url: howToSellForm.value.embed_author_url || null,
                    embed_thumbnail_url: howToSellForm.value.embed_thumbnail_url || null,
                    embed_image_url: howToSellForm.value.embed_image_url || null,
                    embed_footer_text: howToSellForm.value.embed_footer_text || 'BRB Collection • Guide Officiel',
                    embed_footer_icon_url: howToSellForm.value.embed_footer_icon_url || null,
                    embed_show_timestamp: Boolean(howToSellForm.value.embed_show_timestamp),
                    auto_deploy: true
                };

                const res = await fetch(`${API_URL}/discord/info-embeds/how_to_sell`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    howToSellForm.value = {
                        ...howToSellForm.value,
                        ...data,
                        channel_id: data.channel_id ? String(data.channel_id) : ''
                    };
                    howToSellStatus.value = {
                        show: true,
                        success: true,
                        message: data.deploy_status || "Guide « Comment Vendre » mis à jour et déployé avec succès sur Discord !"
                    };
                } else {
                    const err = await res.json().catch(() => ({}));
                    howToSellStatus.value = {
                        show: true,
                        success: false,
                        message: err.detail || "Erreur lors de la sauvegarde du guide."
                    };
                }
            } catch (err) {
                howToSellStatus.value = {
                    show: true,
                    success: false,
                    message: "Erreur de connexion : " + err.message
                };
            } finally {
                isSavingHowToSell.value = false;
                setTimeout(() => { howToSellStatus.value.show = false; }, 6000);
            }
        };

        const undeployHowToSellMessage = async () => {
            if (!confirm("Voulez-vous vraiment retirer le guide « Comment Vendre » du salon Discord ?")) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/discord/info-embeds/how_to_sell/undeploy`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    howToSellForm.value = {
                        ...howToSellForm.value,
                        ...data,
                        deployed_message_id: null,
                        channel_id: data.channel_id ? String(data.channel_id) : ''
                    };
                    howToSellStatus.value = {
                        show: true,
                        success: true,
                        message: "Guide retiré avec succès du salon Discord."
                    };
                }
            } catch (e) {
                alert("Erreur lors du retrait : " + e.message);
            } finally {
                setTimeout(() => { howToSellStatus.value.show = false; }, 6000);
            }
        };

        const insertIntoHowToSellField = (fieldName, textToInsert) => {
            const current = howToSellForm.value[fieldName] || '';
            if (!current) {
                howToSellForm.value[fieldName] = textToInsert;
                return;
            }
            const isInline = textToInsert.startsWith('{') || textToInsert.startsWith('<') || textToInsert.length <= 4;
            if (isInline) {
                howToSellForm.value[fieldName] = current + (current.endsWith(' ') || current.endsWith('\n') ? '' : ' ') + textToInsert;
            } else {
                howToSellForm.value[fieldName] = current + (current.endsWith('\n') ? '' : '\n') + textToInsert;
            }
        };

        const insertLinkPromptHowToSell = (fieldName) => {
            const text = prompt("Texte du lien à afficher :", "Consulter notre site");
            if (!text) return;
            const url = prompt("Adresse Web (URL commençant par https://) :", "https://");
            if (!url) return;
            insertIntoHowToSellField(fieldName, `[${text}](${url})`);
        };

        // --- METHODES PARAMETRES : LOGS DES TICKETS DISCORD ---
        const loadDiscordLogsSettings = async () => {
            if (!user.value || user.value.discord_role !== 1) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/discord/settings/logs`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    discordLogsSettings.value = {
                        logs_enabled: Boolean(data.logs_enabled),
                        logs_channel_id: data.logs_channel_id ? String(data.logs_channel_id) : ''
                    };
                }
            } catch (e) {
                console.error("Erreur chargement logs settings:", e);
            }
        };

        const saveDiscordLogsSettings = async () => {
            if (discordLogsSettings.value.logs_enabled && !discordLogsSettings.value.logs_channel_id) {
                alert("Veuillez sélectionner un salon Discord dans lequel écrire les logs des tickets.");
                return;
            }
            isSavingDiscordLogs.value = true;
            discordLogsStatus.value.show = false;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/discord/settings/logs`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        logs_enabled: Boolean(discordLogsSettings.value.logs_enabled),
                        logs_channel_id: discordLogsSettings.value.logs_channel_id ? String(discordLogsSettings.value.logs_channel_id) : null
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    discordLogsSettings.value = {
                        logs_enabled: Boolean(data.logs_enabled),
                        logs_channel_id: data.logs_channel_id ? String(data.logs_channel_id) : ''
                    };
                    discordLogsStatus.value = {
                        show: true,
                        success: true,
                        message: discordLogsSettings.value.logs_enabled
                            ? "Les logs des tickets sont activés et configurés avec succès !"
                            : "Les logs des tickets ont été désactivés."
                    };
                } else {
                    const err = await res.json().catch(() => ({}));
                    discordLogsStatus.value = {
                        show: true,
                        success: false,
                        message: err.detail || "Erreur lors de l'enregistrement de la configuration des logs."
                    };
                }
            } catch (e) {
                discordLogsStatus.value = {
                    show: true,
                    success: false,
                    message: "Erreur de connexion au serveur."
                };
            } finally {
                isSavingDiscordLogs.value = false;
                setTimeout(() => { discordLogsStatus.value.show = false; }, 6000);
            }
        };

        // --- METHODES MODULE ANNONCES DISCORD ---
        const loadAnnouncements = async () => {
            if (!user.value || user.value.discord_role !== 1) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/discord/announcements`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    discordAnnouncements.value = await res.json();
                }
            } catch (e) {
                console.error("Erreur chargement annonces:", e);
            }
        };

        const getDefaultAnnouncementChannelId = () => {
            const saved = localStorage.getItem('last_announcement_channel_id') || lastSavedAnnouncementChannel.value;
            if (saved) {
                for (const g of (discordChannels.value || [])) {
                    if ((g.channels || []).some(ch => String(ch.id) === String(saved))) {
                        return String(saved);
                    }
                }
            }
            for (const g of (discordChannels.value || [])) {
                if (g.channels && g.channels.length > 0) {
                    const chId = String(g.channels[0].id);
                    localStorage.setItem('last_announcement_channel_id', chId);
                    lastSavedAnnouncementChannel.value = chId;
                    return chId;
                }
            }
            return saved || '';
        };

        const onAnnouncementChannelChange = (chId) => {
            if (chId) {
                localStorage.setItem('last_announcement_channel_id', String(chId));
                lastSavedAnnouncementChannel.value = String(chId);
            }
        };

        const openCreateAnnouncement = () => {
            const defaultChannel = getDefaultAnnouncementChannelId();
            announcementForm.value = {
                id: null,
                title: '',
                channel_id: defaultChannel,
                content: '',
                enable_embed: true,
                embed_title: '',
                embed_title_url: '',
                embed_description: '',
                embed_color: '#5865F2',
                embed_author_name: '',
                embed_author_icon_url: '',
                embed_author_url: '',
                embed_thumbnail_url: '',
                embed_image_url: '',
                embed_footer_text: 'BRB Collection • Annonce',
                embed_footer_icon_url: '',
                embed_show_timestamp: true
            };
            showAnnouncementModal.value = true;
        };

        const openEditAnnouncement = (ann) => {
            const hasExistingEmbed = Boolean(
                ann.embed_title || 
                ann.embed_description || 
                ann.embed_image_url || 
                ann.embed_thumbnail_url || 
                ann.embed_author_name || 
                ann.embed_footer_text
            );
            announcementForm.value = {
                id: ann.id,
                title: ann.title || '',
                channel_id: String(ann.channel_id || ''),
                content: ann.content || '',
                enable_embed: hasExistingEmbed,
                embed_title: ann.embed_title || '',
                embed_title_url: ann.embed_title_url || '',
                embed_description: ann.embed_description || '',
                embed_color: ann.embed_color || '#5865F2',
                embed_author_name: ann.embed_author_name || '',
                embed_author_icon_url: ann.embed_author_icon_url || '',
                embed_author_url: ann.embed_author_url || '',
                embed_thumbnail_url: ann.embed_thumbnail_url || '',
                embed_image_url: ann.embed_image_url || '',
                embed_footer_text: ann.embed_footer_text || '',
                embed_footer_icon_url: ann.embed_footer_icon_url || '',
                embed_show_timestamp: ann.embed_show_timestamp !== false
            };
            showAnnouncementModal.value = true;
        };

        const saveAnnouncement = async () => {
            if (!announcementForm.value.channel_id) {
                alert("Veuillez sélectionner un salon Discord de destination.");
                return;
            }
            // Mémoriser le salon sélectionné de façon semi-permanente
            localStorage.setItem('last_announcement_channel_id', String(announcementForm.value.channel_id));
            lastSavedAnnouncementChannel.value = String(announcementForm.value.channel_id);

            const hasContent = Boolean(announcementForm.value.content && announcementForm.value.content.trim());
            const useEmbed = Boolean(announcementForm.value.enable_embed);
            const hasEmbed = useEmbed && Boolean(
                (announcementForm.value.embed_title && announcementForm.value.embed_title.trim()) ||
                (announcementForm.value.embed_description && announcementForm.value.embed_description.trim()) ||
                (announcementForm.value.embed_image_url && announcementForm.value.embed_image_url.trim()) ||
                (announcementForm.value.embed_thumbnail_url && announcementForm.value.embed_thumbnail_url.trim()) ||
                (announcementForm.value.embed_author_name && announcementForm.value.embed_author_name.trim()) ||
                (announcementForm.value.embed_footer_text && announcementForm.value.embed_footer_text.trim()) ||
                announcementForm.value.embed_show_timestamp
            );

            if (!hasContent && !hasEmbed) {
                alert("Veuillez saisir un texte d'annonce ou activer et configurer un élément d'embed.");
                return;
            }

            isSavingAnnouncement.value = true;
            try {
                const token = localStorage.getItem('token');
                const isEdit = Boolean(announcementForm.value.id);
                const url = isEdit 
                    ? `${API_URL}/discord/announcements/${announcementForm.value.id}` 
                    : `${API_URL}/discord/announcements`;
                const method = isEdit ? 'PUT' : 'POST';

                const payload = {
                    title: announcementForm.value.title || (useEmbed && announcementForm.value.embed_title ? announcementForm.value.embed_title : 'Annonce'),
                    channel_id: String(announcementForm.value.channel_id),
                    content: announcementForm.value.content || null,
                    embed_title: useEmbed ? (announcementForm.value.embed_title || null) : null,
                    embed_title_url: useEmbed ? (announcementForm.value.embed_title_url || null) : null,
                    embed_description: useEmbed ? (announcementForm.value.embed_description || null) : null,
                    embed_color: useEmbed ? (announcementForm.value.embed_color || '#5865F2') : null,
                    embed_author_name: useEmbed ? (announcementForm.value.embed_author_name || null) : null,
                    embed_author_icon_url: useEmbed ? (announcementForm.value.embed_author_icon_url || null) : null,
                    embed_author_url: useEmbed ? (announcementForm.value.embed_author_url || null) : null,
                    embed_thumbnail_url: useEmbed ? (announcementForm.value.embed_thumbnail_url || null) : null,
                    embed_image_url: useEmbed ? (announcementForm.value.embed_image_url || null) : null,
                    embed_footer_text: useEmbed ? (announcementForm.value.embed_footer_text || null) : null,
                    embed_footer_icon_url: useEmbed ? (announcementForm.value.embed_footer_icon_url || null) : null,
                    embed_show_timestamp: useEmbed ? Boolean(announcementForm.value.embed_show_timestamp) : false
                };

                const res = await fetch(url, {
                    method,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showAnnouncementModal.value = false;
                    await loadAnnouncements();
                    announcementStatus.value = {
                        show: true,
                        success: true,
                        message: isEdit ? "Annonce mise à jour avec succès sur Discord !" : "Annonce publiée avec succès sur Discord !"
                    };
                } else {
                    const err = await res.json().catch(() => ({}));
                    announcementStatus.value = {
                        show: true,
                        success: false,
                        message: err.detail || "Erreur lors de la diffusion de l'annonce."
                    };
                }
            } catch (e) {
                announcementStatus.value = {
                    show: true,
                    success: false,
                    message: "Erreur de connexion au serveur."
                };
            } finally {
                isSavingAnnouncement.value = false;
                setTimeout(() => { announcementStatus.value.show = false; }, 6000);
            }
        };

        const deleteAnnouncement = async (annId) => {
            if (!confirm("Voulez-vous vraiment supprimer cette annonce ? Elle sera immédiatement supprimée du salon Discord.")) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/discord/announcements/${annId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    await loadAnnouncements();
                    announcementStatus.value = {
                        show: true,
                        success: true,
                        message: "L'annonce a bien été supprimée de Discord et de l'historique."
                    };
                } else {
                    const err = await res.json().catch(() => ({}));
                    alert(err.detail || "Erreur lors de la suppression de l'annonce.");
                }
            } catch (e) {
                alert("Erreur de connexion lors de la suppression.");
            } finally {
                setTimeout(() => { announcementStatus.value.show = false; }, 5000);
            }
        };

        const insertIntoAnnouncementField = (fieldName, textToInsert) => {
            const current = announcementForm.value[fieldName] || '';
            if (!current) {
                announcementForm.value[fieldName] = textToInsert;
                return;
            }
            const isInline = textToInsert.startsWith('{') || textToInsert.startsWith('<') || textToInsert.length <= 4;
            if (isInline) {
                announcementForm.value[fieldName] = current + (current.endsWith(' ') || current.endsWith('\n') ? '' : ' ') + textToInsert;
            } else {
                announcementForm.value[fieldName] = current + (current.endsWith('\n') ? '' : '\n') + textToInsert;
            }
        };

        const insertLinkPromptAnnouncement = (fieldName) => {
            const text = prompt("Texte du lien à afficher :", "En savoir plus");
            if (!text) return;
            const url = prompt("Adresse Web (URL commençant par https://) :", "https://");
            if (!url) return;
            insertIntoAnnouncementField(fieldName, `[${text}](${url})`);
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
                modal_title: '',
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
                embed_title_url: '',
                embed_description: 'Cliquez sur le bouton ci-dessous pour ouvrir un ticket.',
                embed_color: '#3B82F6',
                embed_author_name: '',
                embed_author_icon_url: '',
                embed_author_url: '',
                embed_thumbnail_url: '',
                embed_image_url: '',
                embed_footer_text: 'Système de Ticketing',
                embed_footer_icon_url: '',
                embed_show_timestamp: false,
                button_text: 'Ouvrir un ticket',
                button_emoji: '🎫',
                button_color: 'primary',
                active_category_id: '',
                archive_category_id: '',
                ping_role_id: '',
                ping_creator: true,
                max_tickets_per_user: 1,
                intro_embed_title: 'Bienvenue dans votre ticket',
                intro_message: 'Veuillez patienter, un membre du staff va vous répondre.',
                intro_embed_color: '',
                intro_thumbnail_url: '',
                intro_image_url: '',
                intro_footer_text: '',
                inactivity_days: 3,
                close_button_text: 'Fermer le ticket',
                close_button_color: 'danger',
                close_button_emoji: '🔒',
                close_reason_button_text: 'Fermer avec raison',
                close_reason_button_color: 'secondary',
                close_reason_button_emoji: '📝',
                reopen_button_text: 'Ré-ouvrir',
                reopen_button_color: 'success',
                reopen_button_emoji: '🔓',
                delete_button_text: 'Supprimer',
                delete_button_color: 'danger',
                delete_button_emoji: '🗑️',
                creator_can_close: true,
                creator_can_close_with_reason: false,
                dm_transcript_on_close: true,
                dm_embed_title: '🔒 Ticket fermé — {ticket_name}',
                dm_embed_title_url: '',
                dm_embed_description: 'Votre ticket **{ticket_name}** a été clôturé par **{closed_by}**.\nVous trouverez ci-joint l\'archive complète de votre conversation.',
                dm_embed_color: '',
                dm_thumbnail_url: '',
                dm_image_url: '',
                dm_footer_text: 'Téléchargez et ouvrez le fichier .html pour relire la conversation.',
                dm_footer_icon_url: '',
                dm_show_timestamp: true
            };
            showDiscordPanelModal.value = true;
        };

        const openEditDiscordPanel = (panel) => {
            discordPanelForm.value = {
                id: panel.id,
                name: panel.name || '',
                modal_title: panel.modal_title || '',
                embed_title: panel.embed_title || '',
                embed_title_url: panel.embed_title_url || '',
                embed_description: panel.embed_description || '',
                embed_color: panel.embed_color || '#3B82F6',
                embed_author_name: panel.embed_author_name || '',
                embed_author_icon_url: panel.embed_author_icon_url || '',
                embed_author_url: panel.embed_author_url || '',
                embed_thumbnail_url: panel.embed_thumbnail_url || '',
                embed_image_url: panel.embed_image_url || '',
                embed_footer_text: panel.embed_footer_text !== undefined && panel.embed_footer_text !== null ? panel.embed_footer_text : 'Système de Ticketing',
                embed_footer_icon_url: panel.embed_footer_icon_url || '',
                embed_show_timestamp: Boolean(panel.embed_show_timestamp),
                button_text: panel.button_text || '',
                button_emoji: panel.button_emoji || '',
                button_color: panel.button_color || 'primary',
                active_category_id: panel.active_category_id ? String(panel.active_category_id) : '',
                archive_category_id: panel.archive_category_id ? String(panel.archive_category_id) : '',
                ping_role_id: panel.ping_role_id ? String(panel.ping_role_id) : '',
                ping_creator: panel.ping_creator !== undefined ? panel.ping_creator : true,
                max_tickets_per_user: panel.max_tickets_per_user || 1,
                intro_embed_title: panel.intro_embed_title || 'Bienvenue dans votre ticket',
                intro_message: panel.intro_message || '',
                intro_embed_color: panel.intro_embed_color || '',
                intro_thumbnail_url: panel.intro_thumbnail_url || '',
                intro_image_url: panel.intro_image_url || '',
                intro_footer_text: panel.intro_footer_text || '',
                inactivity_days: panel.inactivity_days || 3,
                deployed_channel_id: panel.deployed_channel_id || null,
                deployed_message_id: panel.deployed_message_id || null,
                close_button_text: panel.close_button_text || 'Fermer le ticket',
                close_button_color: panel.close_button_color || 'danger',
                close_button_emoji: panel.close_button_emoji || '🔒',
                close_reason_button_text: panel.close_reason_button_text || 'Fermer avec raison',
                close_reason_button_color: panel.close_reason_button_color || 'secondary',
                close_reason_button_emoji: panel.close_reason_button_emoji || '📝',
                reopen_button_text: panel.reopen_button_text || 'Ré-ouvrir',
                reopen_button_color: panel.reopen_button_color || 'success',
                reopen_button_emoji: panel.reopen_button_emoji || '🔓',
                delete_button_text: panel.delete_button_text || 'Supprimer',
                delete_button_color: panel.delete_button_color || 'danger',
                delete_button_emoji: panel.delete_button_emoji || '🗑️',
                creator_can_close: panel.creator_can_close !== undefined ? Boolean(panel.creator_can_close) : true,
                creator_can_close_with_reason: panel.creator_can_close_with_reason !== undefined ? Boolean(panel.creator_can_close_with_reason) : false,
                dm_transcript_on_close: panel.dm_transcript_on_close !== undefined ? Boolean(panel.dm_transcript_on_close) : true,
                dm_embed_title: panel.dm_embed_title || '🔒 Ticket fermé — {ticket_name}',
                dm_embed_title_url: panel.dm_embed_title_url || '',
                dm_embed_description: panel.dm_embed_description !== undefined && panel.dm_embed_description !== null ? panel.dm_embed_description : 'Votre ticket **{ticket_name}** a été clôturé par **{closed_by}**.\nVous trouverez ci-joint l\'archive complète de votre conversation.',
                dm_embed_color: panel.dm_embed_color || '',
                dm_thumbnail_url: panel.dm_thumbnail_url || '',
                dm_image_url: panel.dm_image_url || '',
                dm_footer_text: panel.dm_footer_text !== undefined && panel.dm_footer_text !== null ? panel.dm_footer_text : 'Téléchargez et ouvrez le fichier .html pour relire la conversation.',
                dm_footer_icon_url: panel.dm_footer_icon_url || '',
                dm_show_timestamp: panel.dm_show_timestamp !== undefined ? Boolean(panel.dm_show_timestamp) : true
            };
            showDiscordPanelModal.value = true;
        };

        const insertIntoPanelField = (fieldName, textToInsert) => {
            const current = discordPanelForm.value[fieldName] || '';
            if (!current) {
                discordPanelForm.value[fieldName] = textToInsert;
                return;
            }
            const isInline = textToInsert.startsWith('{') || textToInsert.startsWith('<') || textToInsert.length <= 4;
            if (isInline) {
                discordPanelForm.value[fieldName] = current + (current.endsWith(' ') || current.endsWith('\n') ? '' : ' ') + textToInsert;
            } else {
                discordPanelForm.value[fieldName] = current + (current.endsWith('\n') ? '' : '\n') + textToInsert;
            }
        };

        const insertLinkPrompt = (fieldName) => {
            const text = prompt("Texte du lien à afficher :", "Consulter notre site");
            if (!text) return;
            const url = prompt("Adresse Web (URL commençant par https://) :", "https://");
            if (!url) return;
            insertIntoPanelField(fieldName, `[${text}](${url})`);
        };

        const formatDiscordPreview = (rawText) => {
            if (!rawText) return '';
            let safe = String(rawText)
                .replace(/{ticket_name}/g, 'alan-001')
                .replace(/{user_name}/g, 'alan')
                .replace(/{closed_by}/g, '@Staff')
                .replace(/{close_reason}|{reason}/g, 'Achat conclu / Lot validé')
                .replace(/{panel_name}/g, discordPanelForm.value.name || 'Support')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Salons <#123456789>
            safe = safe.replace(/&lt;#(\d+)&gt;/g, (match, chId) => {
                let chName = 'salon';
                for (const g of (discordChannels.value || [])) {
                    const c = (g.channels || g.text_channels || []).find(tc => String(tc.id) === String(chId));
                    if (c) { chName = c.name; break; }
                }
                return `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#5865F2]/20 text-[#c9cdfb] font-medium text-xs hover:bg-[#5865F2]/30 cursor-pointer align-baseline select-none"><span class="opacity-70">#</span>${chName}</span>`;
            });

            // Rôles <@&123456789>
            safe = safe.replace(/&lt;@&amp;(\d+)&gt;/g, (match, rId) => {
                let rName = 'rôle';
                for (const g of (discordChannels.value || [])) {
                    const r = (g.roles || []).find(ro => String(ro.id) === String(rId));
                    if (r) { rName = r.name; break; }
                }
                return `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#5865F2]/20 text-[#c9cdfb] font-medium text-xs hover:bg-[#5865F2]/30 cursor-pointer align-baseline select-none"><span class="opacity-70">@</span>${rName}</span>`;
            });

            // Utilisateurs <@123456789>
            safe = safe.replace(/&lt;@!?(\d+)&gt;/g, '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-[#5865F2]/20 text-[#c9cdfb] font-medium text-xs hover:bg-[#5865F2]/30 cursor-pointer align-baseline select-none">@utilisateur</span>');

            // Liens masqués [Texte](URL)
            safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#00a8fc] hover:underline cursor-pointer">$1</a>');

            // Formatages Markdown gras, italique, souligné, barré, code
            safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
            safe = safe.replace(/\*([^*]+)\*/g, '<em class="italic text-[#dbdee1]">$1</em>');
            safe = safe.replace(/__([^_]+)__/g, '<span class="underline">$1</span>');
            safe = safe.replace(/~~([^~]+)~~/g, '<span class="line-through text-gray-400">$1</span>');
            safe = safe.replace(/`([^`]+)`/g, '<code class="bg-[#1e1f22] text-[#e0e1e5] px-1 py-0.5 rounded font-mono text-xs">$1</code>');

            // Citations markdown "> Citation"
            safe = safe.replace(/(?:^|\n)&gt; (.*)/g, '\n<div class="border-l-[3px] border-[#4e5058] pl-2 text-[#b5bac1] my-0.5">$1</div>');

            // Sauts de ligne
            safe = safe.replace(/\n/g, '<br>');

            return safe;
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
                    modal_title: discordPanelForm.value.modal_title || null,
                    embed_title: discordPanelForm.value.embed_title,
                    embed_title_url: discordPanelForm.value.embed_title_url || null,
                    embed_description: discordPanelForm.value.embed_description,
                    embed_color: discordPanelForm.value.embed_color,
                    embed_author_name: discordPanelForm.value.embed_author_name || null,
                    embed_author_icon_url: discordPanelForm.value.embed_author_icon_url || null,
                    embed_author_url: discordPanelForm.value.embed_author_url || null,
                    embed_thumbnail_url: discordPanelForm.value.embed_thumbnail_url || null,
                    embed_image_url: discordPanelForm.value.embed_image_url || null,
                    embed_footer_text: discordPanelForm.value.embed_footer_text || "Système de Ticketing",
                    embed_footer_icon_url: discordPanelForm.value.embed_footer_icon_url || null,
                    embed_show_timestamp: Boolean(discordPanelForm.value.embed_show_timestamp),
                    button_text: discordPanelForm.value.button_text,
                    button_emoji: discordPanelForm.value.button_emoji,
                    button_color: discordPanelForm.value.button_color,
                    active_category_id: discordPanelForm.value.active_category_id || null,
                    archive_category_id: discordPanelForm.value.archive_category_id || null,
                    ping_role_id: discordPanelForm.value.ping_role_id || null,
                    ping_creator: discordPanelForm.value.ping_creator,
                    max_tickets_per_user: parseInt(discordPanelForm.value.max_tickets_per_user) || 1,
                    intro_embed_title: discordPanelForm.value.intro_embed_title || "Bienvenue dans votre ticket",
                    intro_message: discordPanelForm.value.intro_message,
                    intro_embed_color: discordPanelForm.value.intro_embed_color || null,
                    intro_thumbnail_url: discordPanelForm.value.intro_thumbnail_url || null,
                    intro_image_url: discordPanelForm.value.intro_image_url || null,
                    intro_footer_text: discordPanelForm.value.intro_footer_text || null,
                    inactivity_days: parseInt(discordPanelForm.value.inactivity_days) || 3,
                    close_button_text: discordPanelForm.value.close_button_text,
                    close_button_color: discordPanelForm.value.close_button_color,
                    close_button_emoji: discordPanelForm.value.close_button_emoji,
                    close_reason_button_text: discordPanelForm.value.close_reason_button_text,
                    close_reason_button_color: discordPanelForm.value.close_reason_button_color,
                    close_reason_button_emoji: discordPanelForm.value.close_reason_button_emoji,
                    reopen_button_text: discordPanelForm.value.reopen_button_text,
                    reopen_button_color: discordPanelForm.value.reopen_button_color,
                    reopen_button_emoji: discordPanelForm.value.reopen_button_emoji,
                    delete_button_text: discordPanelForm.value.delete_button_text,
                    delete_button_color: discordPanelForm.value.delete_button_color,
                    delete_button_emoji: discordPanelForm.value.delete_button_emoji,
                    creator_can_close: Boolean(discordPanelForm.value.creator_can_close),
                    creator_can_close_with_reason: Boolean(discordPanelForm.value.creator_can_close_with_reason),
                    dm_transcript_on_close: Boolean(discordPanelForm.value.dm_transcript_on_close),
                    dm_embed_title: discordPanelForm.value.dm_embed_title || "🔒 Ticket fermé — {ticket_name}",
                    dm_embed_title_url: discordPanelForm.value.dm_embed_title_url || null,
                    dm_embed_description: discordPanelForm.value.dm_embed_description || null,
                    dm_embed_color: discordPanelForm.value.dm_embed_color || null,
                    dm_thumbnail_url: discordPanelForm.value.dm_thumbnail_url || null,
                    dm_image_url: discordPanelForm.value.dm_image_url || null,
                    dm_footer_text: discordPanelForm.value.dm_footer_text || null,
                    dm_footer_icon_url: discordPanelForm.value.dm_footer_icon_url || null,
                    dm_show_timestamp: Boolean(discordPanelForm.value.dm_show_timestamp),
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
            if(!confirm("Supprimer ce panel (et ses questions) ?\n\nSi le bouton est actuellement présent sur Discord, il sera également supprimé du serveur.")) return;
            try {
                const res = await fetch(`${API_URL}/discord/panels/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    await loadDiscordData();
                } else {
                    alert("Erreur lors de la suppression du panel.");
                }
            } catch(e) {
                alert("Erreur réseau");
            }
        };

        const undeployDiscordPanel = async (panel) => {
            if (!confirm(`Retirer le bouton de Discord pour le panel "${panel.name}" ?\n\nLe message du panel sera immédiatement supprimé du salon Discord.`)) return;
            try {
                const res = await fetch(`${API_URL}/discord/panels/${panel.id}/undeploy`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    await loadDiscordData();
                } else {
                    alert("Erreur lors du retrait du panel de Discord.");
                }
            } catch(e) {
                alert("Erreur réseau");
            }
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
        
        const resetDiscordFieldForm = () => {
            discordFieldForm.value = getEmptyDiscordFieldForm(discordFields.value.length);
        };

        const editDiscordField = (field) => {
            const effectiveType = field.field_type || (field.is_paragraph ? 'paragraph' : 'short_text');
            const clonedOptions = Array.isArray(field.options) && field.options.length > 0
                ? field.options.map(o => ({
                    label: o.label || '',
                    value: o.value || o.label || '',
                    description: o.description || '',
                    emoji: o.emoji || '',
                    default: Boolean(o.default)
                }))
                : [{ label: '', value: '', description: '', emoji: '', default: false }];

            discordFieldForm.value = {
                id: field.id,
                label: field.label || '',
                field_type: effectiveType,
                is_paragraph: effectiveType === 'paragraph',
                description: field.description || '',
                placeholder: field.placeholder || '',
                required: field.required !== undefined ? Boolean(field.required) : true,
                min_length: field.min_length !== undefined && field.min_length !== null ? field.min_length : null,
                max_length: field.max_length !== undefined && field.max_length !== null ? field.max_length : null,
                default_value: field.default_value || '',
                options: clonedOptions,
                min_values: field.min_values !== undefined && field.min_values !== null ? field.min_values : 1,
                max_values: field.max_values || (effectiveType === 'file_upload' ? 5 : 1),
                order: field.order !== undefined ? field.order : 0
            };
        };

        const addDiscordSelectOption = () => {
            if (!Array.isArray(discordFieldForm.value.options)) {
                discordFieldForm.value.options = [];
            }
            if (discordFieldForm.value.options.length >= 25) {
                alert("Discord limite les listes déroulantes à 25 options maximum.");
                return;
            }
            discordFieldForm.value.options.push({
                label: '',
                value: '',
                description: '',
                emoji: '',
                default: false
            });
        };

        const removeDiscordSelectOption = (idx) => {
            if (!Array.isArray(discordFieldForm.value.options)) return;
            if (discordFieldForm.value.options.length <= 1) {
                discordFieldForm.value.options = [{ label: '', value: '', description: '', emoji: '', default: false }];
                return;
            }
            discordFieldForm.value.options.splice(idx, 1);
        };

        const moveDiscordSelectOption = (idx, dir) => {
            const opts = discordFieldForm.value.options;
            if (!Array.isArray(opts)) return;
            const target = idx + dir;
            if (target < 0 || target >= opts.length) return;
            const temp = opts[idx];
            opts[idx] = opts[target];
            opts[target] = temp;
        };

        const openFieldsManager = async (panel) => {
            currentFieldPanelId.value = panel.id;
            currentFieldPanel.value = { ...panel };
            previewDropdownOpenIdx.value = null;
            try {
                const res = await fetch(`${API_URL}/discord/panels/${panel.id}/fields`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    discordFields.value = await res.json();
                    resetDiscordFieldForm();
                    showDiscordFieldsModal.value = true;
                }
            } catch(e) {}
        };
        
        const saveDiscordField = async () => {
            if (discordFields.value.length >= 5 && !discordFieldForm.value.id) {
                alert("Discord limite les formulaires à 5 questions maximum.");
                return;
            }
            const ftype = discordFieldForm.value.field_type || 'short_text';
            let validOptions = null;
            if (ftype === 'select') {
                validOptions = (discordFieldForm.value.options || [])
                    .filter(o => o && o.label && String(o.label).trim() !== '')
                    .map(o => ({
                        label: String(o.label).trim().slice(0, 100),
                        value: String(o.value || o.label).trim().slice(0, 100),
                        description: String(o.description || '').trim().slice(0, 100),
                        emoji: String(o.emoji || '').trim(),
                        default: Boolean(o.default)
                    }));
                if (validOptions.length === 0) {
                    alert("Veuillez ajouter au moins un choix dans la liste déroulante.");
                    return;
                }
            }

            try {
                const method = discordFieldForm.value.id ? 'PUT' : 'POST';
                const url = discordFieldForm.value.id 
                    ? `${API_URL}/discord/fields/${discordFieldForm.value.id}` 
                    : `${API_URL}/discord/panels/${currentFieldPanelId.value}/fields`;
                
                const minLen = discordFieldForm.value.min_length !== '' && discordFieldForm.value.min_length !== null
                    ? parseInt(discordFieldForm.value.min_length)
                    : null;
                const maxLen = discordFieldForm.value.max_length !== '' && discordFieldForm.value.max_length !== null
                    ? parseInt(discordFieldForm.value.max_length)
                    : null;

                const isReq = Boolean(discordFieldForm.value.required);
                let minVals = parseInt(discordFieldForm.value.min_values);
                if (isNaN(minVals)) minVals = isReq ? 1 : 0;
                if (!isReq && ftype === 'file_upload') minVals = 0;

                let maxVals = parseInt(discordFieldForm.value.max_values) || 1;
                if (ftype === 'file_upload') {
                    maxVals = Math.max(1, Math.min(maxVals, 10));
                    if (isReq) minVals = Math.max(1, Math.min(minVals, maxVals));
                }

                const res = await fetch(url, {
                    method,
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        label: discordFieldForm.value.label,
                        field_type: ftype,
                        is_paragraph: ftype === 'paragraph',
                        description: discordFieldForm.value.description || null,
                        placeholder: discordFieldForm.value.placeholder || null,
                        required: isReq,
                        min_length: !isNaN(minLen) ? minLen : null,
                        max_length: !isNaN(maxLen) ? maxLen : null,
                        default_value: discordFieldForm.value.default_value || null,
                        options: validOptions,
                        min_values: minVals,
                        max_values: maxVals,
                        order: parseInt(discordFieldForm.value.order) || 0
                    })
                });
                if (res.ok) {
                    const refRes = await fetch(`${API_URL}/discord/panels/${currentFieldPanelId.value}/fields`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    if (refRes.ok) discordFields.value = await refRes.json();
                    resetDiscordFieldForm();
                } else {
                    const err = await res.json().catch(() => ({}));
                    alert("Erreur : " + (err.detail || "Impossible d'enregistrer la question"));
                }
            } catch(e) {
                console.error(e);
            }
        };

        const moveDiscordField = async (idx, dir) => {
            const list = [...discordFields.value];
            const target = idx + dir;
            if (target < 0 || target >= list.length) return;
            const temp = list[idx];
            list[idx] = list[target];
            list[target] = temp;
            list.forEach((f, i) => { f.order = i; });
            discordFields.value = list;
            try {
                const res = await fetch(`${API_URL}/discord/panels/${currentFieldPanelId.value}/fields/reorder`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ field_ids: list.map(f => f.id) })
                });
                if (res.ok) {
                    discordFields.value = await res.json();
                }
            } catch (e) {
                console.error(e);
            }
        };
        
        const deleteDiscordField = async (id) => {
            if(!confirm("Supprimer cette question ?")) return;
            try {
                const res = await fetch(`${API_URL}/discord/fields/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    discordFields.value = discordFields.value.filter(f => f.id !== id);
                    if (discordFieldForm.value.id === id) {
                        resetDiscordFieldForm();
                    }
                }
            } catch(e) {}
        };

        const getWebActorPayload = () => {
            if (!user.value) return {};
            const fullName = `${user.value.first_name || ''} ${user.value.last_name || ''}`.trim();
            return {
                actor_name: fullName || user.value.email || 'Utilisateur Web',
                actor_email: user.value.email || null
            };
        };

        const closeDiscordTicket = async (id, withReason = false) => {
            let reason = null;
            if (withReason) {
                const input = prompt("Indiquez le motif de fermeture du ticket (sera affiché dans l'archive et envoyé en MP au créateur) :", "");
                if (input === null) return;
                reason = input.trim();
                if (!reason) {
                    alert("Veuillez saisir un motif de fermeture.");
                    return;
                }
            } else {
                if (!confirm("Fermer ce ticket ?")) return;
            }
            try {
                const payload = {
                    ...getWebActorPayload(),
                    ...(reason ? { reason } : {})
                };
                const res = await fetch(`${API_URL}/discord/tickets/${id}/close`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    loadDiscordData();
                } else {
                    alert("Erreur lors de la fermeture du ticket");
                }
            } catch(e) {}
        };

        const reopenDiscordTicket = async (ticket) => {
            if (!ticket || !ticket.id) return;
            const isDeleted = !ticket.channel_id || ticket.channel_exists === false;
            const label = ticket.ticket_name || ('ticket' + String(ticket.id).padStart(3, '0'));
            const confirmMsg = isDeleted
                ? `Le salon Discord du ticket #${label} a été supprimé.\n\nVoulez-vous recréer son salon Discord au bon endroit avec tous ses droits d'origine et ré-ouvrir le ticket ?`
                : `Voulez-vous ré-ouvrir le ticket #${label} sur Discord ?`;
            if (!confirm(confirmMsg)) return;
            try {
                const res = await fetch(`${API_URL}/discord/tickets/${ticket.id}/reopen`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(getWebActorPayload())
                });
                if (res.ok) {
                    await loadDiscordData();
                } else {
                    let errText = "Erreur lors de la réouverture du ticket";
                    try {
                        const errData = await res.json();
                        if (errData && errData.detail) errText = errData.detail;
                    } catch (_) {}
                    alert(errText);
                }
            } catch (e) {
                alert("Erreur réseau lors de la réouverture du ticket");
            }
        };

        const deleteDiscordTicketChannel = async (ticket) => {
            if (!ticket || !ticket.id) return;
            const label = ticket.ticket_name || ('ticket' + String(ticket.id).padStart(3, '0'));
            if (!confirm(`Supprimer le salon Discord du ticket #${label} ?\n\nL'historique et l'archive HTML resteront intégralement consultables sur l'interface web, et vous pourrez toujours le ré-ouvrir plus tard si besoin.`)) return;
            try {
                const res = await fetch(`${API_URL}/discord/tickets/${ticket.id}/delete-channel`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(getWebActorPayload())
                });
                if (res.ok) {
                    await loadDiscordData();
                } else {
                    let errText = "Erreur lors de la suppression du salon Discord";
                    try {
                        const errData = await res.json();
                        if (errData && errData.detail) errText = errData.detail;
                    } catch (_) {}
                    alert(errText);
                }
            } catch (e) {
                alert("Erreur réseau lors de la suppression du salon Discord");
            }
        };

        const parseAnswerAttachments = (answer) => {
            if (!answer || typeof answer !== 'string') return [];
            const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
            const matches = [];
            let match;
            while ((match = regex.exec(answer)) !== null) {
                const filename = match[1];
                const url = match[2];
                const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(filename) || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
                matches.push({ filename, url, isImage });
            }
            return matches;
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
                    (t.ticket_name && t.ticket_name.toLowerCase().includes(s)) ||
                    (t.creator_id && t.creator_id.toString().includes(s)) ||
                    (t.creator_username && t.creator_username.toLowerCase().includes(s)) ||
                    (t.close_reason && t.close_reason.toLowerCase().includes(s)) ||
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
            } else if (tab === 'announcements') {
                loadAnnouncements();
            } else if (tab === 'panels') {
                if (discordSettingsSubTab.value === 'how_to_sell') {
                    loadHowToSellSettings();
                } else if (discordSettingsSubTab.value === 'logs') {
                    loadDiscordLogsSettings();
                }
            }
        });

        watch(discordSettingsSubTab, (sub) => {
            if (sub === 'how_to_sell') {
                loadHowToSellSettings();
            } else if (sub === 'logs') {
                loadDiscordLogsSettings();
            }
        });

        watch(displayedDiscordTickets, () => {
            setTimeout(initTicketsObserver, 100);
        });

        // 🎨 Gestion du Thème (Clair / Sombre / Système par défaut)
        const themeMode = ref(localStorage.getItem('themeMode') || 'system');
        const resolvedTheme = ref('light');

        const applyTheme = (mode) => {
            const m = mode || themeMode.value || 'system';
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const isDark = m === 'dark' || (m === 'system' && prefersDark);
            resolvedTheme.value = isDark ? 'dark' : 'light';
            if (isDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.setAttribute('data-theme', 'light');
            }
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                metaThemeColor.setAttribute('content', isDark ? '#0f172a' : '#2563EB');
            }
        };

        const setThemeMode = (mode) => {
            if (!['light', 'dark', 'system'].includes(mode)) mode = 'system';
            themeMode.value = mode;
            localStorage.setItem('themeMode', mode);
            applyTheme(mode);
        };

        // Appliquer dès l'initialisation
        applyTheme(themeMode.value);

        onMounted(() => {
            applyTheme(themeMode.value);
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                const handleSystemThemeChange = () => {
                    if (themeMode.value === 'system') {
                        applyTheme('system');
                    }
                };
                if (mediaQuery.addEventListener) {
                    mediaQuery.addEventListener('change', handleSystemThemeChange);
                } else if (mediaQuery.addListener) {
                    mediaQuery.addListener(handleSystemThemeChange);
                }
            }
            fetchUser();
            window.addEventListener('scroll', handleWindowScroll, { passive: true });
            setTimeout(initTicketsObserver, 500);
        });

        return {
            themeMode, resolvedTheme, setThemeMode,
            user, currentTab, loginForm, eventForm, shiftTypeForm, inviteEmail, teamMembers, shiftTypes, apiUrl: API_URL, fullApiUrl: FULL_API_URL, loginError,
            newTeam, managerForm, allTeams, myTeam, showEventModal, eventPopover, mobileMenuOpen,
            logout, inviteUser, addShiftType, addEvent, createTeam, handleFileUpload, addManager, removeManager, deleteTeam,
            updateMyTeam, handleMyTeamLogoUpload, removeMember, editEvent, deleteEvent, openCreateEventModal, addEventOnSameSlot,
            discordTab, discordStats, discordPanels, discordTickets, discordChannels, discordSearch, discordDateFilter, discordSortDate, 
            showDiscordPanelModal, showDiscordPreviewModal, discordPreviewTab, discordPanelForm, showDiscordTicketArchive, discordTicketArchiveHtml, 
            showDiscordFieldsModal, discordFields, currentFieldPanelId, currentFieldPanel, previewDropdownOpenIdx, discordFieldForm, showDiscordDeployModal, discordDeployForm,
            saveDiscordPanel, deleteDiscordPanel, undeployDiscordPanel, openDeployModal, executeDiscordDeploy, openFieldsManager, saveDiscordField, deleteDiscordField,
            resetDiscordFieldForm, editDiscordField, addDiscordSelectOption, removeDiscordSelectOption, moveDiscordSelectOption, moveDiscordField,
            openCreateDiscordPanel, openEditDiscordPanel, insertIntoPanelField, insertLinkPrompt, formatDiscordPreview,
            openDiscordArchive, closeDiscordTicket, reopenDiscordTicket, deleteDiscordTicketChannel, parseAnswerAttachments, filteredDiscordTickets, loadDiscordData,
            displayedDiscordTickets, hasMoreTickets, loadMoreTickets, visibleTicketsLimit, isLoadingMoreTickets, ticketsPageSize,
            discordBotProfile, isSavingBotProfile, botProfileSaveStatus, fetchBotProfile, handleBotAvatarChange, cancelBotAvatarPreview, triggerBotAvatarUpload, saveBotProfile,
            discordSettingsSubTab, howToSellForm, isSavingHowToSell, howToSellStatus, loadHowToSellSettings, saveHowToSellSettings, undeployHowToSellMessage, insertIntoHowToSellField, insertLinkPromptHowToSell, getDiscordChannelName,
            discordLogsSettings, isSavingDiscordLogs, discordLogsStatus, loadDiscordLogsSettings, saveDiscordLogsSettings,
            discordAnnouncements, showAnnouncementModal, isSavingAnnouncement, announcementStatus, announcementForm, currentDiscordTime,
            loadAnnouncements, openCreateAnnouncement, openEditAnnouncement, saveAnnouncement, deleteAnnouncement,
            insertIntoAnnouncementField, insertLinkPromptAnnouncement, lastSavedAnnouncementChannel, onAnnouncementChannelChange,
            adminSubTab, allUsers, userSearch, userFilterTeam, userFilterStatus, filteredUsers, isImpersonating, impersonatedEmail,
            showRoleModal, roleModalUser, roleModalForm, showDeleteUserModal, deleteUserTarget,
            fetchUsers, toggleBlockUser, disconnectUser, openRoleModal, saveUserRoles, promptDeleteUser, executeDeleteUser, impersonateUser, stopImpersonating
        };
    }
}).mount('#app');
