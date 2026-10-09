const { createApp, ref, onMounted, watch } = Vue;

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
                    if (user.value.is_admin) fetchTeams();
                    if (currentTab.value === 'planning') setTimeout(initCalendar, 100);
                } else {
                    logout();
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
                slotMinTime: '06:00:00',
                slotMaxTime: '23:00:00',
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
        onMounted(() => {
            fetchUser();
        });

        return {
            user, currentTab, loginForm, eventForm, shiftTypeForm, inviteEmail, teamMembers, shiftTypes, apiUrl: API_URL, fullApiUrl: FULL_API_URL, loginError,
            newTeam, managerForm, allTeams, myTeam, showEventModal, eventPopover, mobileMenuOpen,
            logout, inviteUser, addShiftType, addEvent, createTeam, handleFileUpload, addManager, removeManager, deleteTeam,
            updateMyTeam, handleMyTeamLogoUpload, removeMember, editEvent, deleteEvent, openCreateEventModal, addEventOnSameSlot
        };
    }
}).mount('#app');
