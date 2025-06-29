import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  Edit, 
  ArrowLeft,
  Users,
  Clock,
  Church,
  User,
  Trash2,
  Plus,
  Calendar as CalendarIcon,
  Crown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMembers, getMemberAttendance, getMemberGroups, updateMember, deleteMember } from '../lib/data';
import { familyService } from '../lib/familyService';
import MemberForm from '@/components/members/MemberForm';
import { formatName, getInitials, formatPhoneNumber } from '@/lib/utils/formatters';
import { supabase } from '@/lib/supabase';

export function MemberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [member, setMember] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(true);
  const [isGroupsLoading, setIsGroupsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRetroCheckInOpen, setIsRetroCheckInOpen] = useState(false);
  const [pastEvents, setPastEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [familyInfo, setFamilyInfo] = useState(null);
  const [isFamilyLoading, setIsFamilyLoading] = useState(true);

  useEffect(() => {
    loadMemberData();
  }, [id]);

  const loadMemberData = async () => {
    try {
      const members = await getMembers();
      const foundMember = members.find(m => m.id === id);
      if (foundMember) {
        setMember(foundMember);
        loadAttendance(foundMember.id);
        loadGroups(foundMember.id);
        loadFamilyInfo(foundMember.id);
      } else {
        toast({
          title: "Error",
          description: "Person not found",
          variant: "destructive",
        });
        navigate('/members');
      }
    } catch (error) {
      console.error('Error loading person:', error);
      toast({
        title: "Error",
        description: "Failed to load person data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttendance = async (memberId) => {
    setIsAttendanceLoading(true);
    try {
      const data = await getMemberAttendance(memberId);
      setAttendance(data);
    } catch (error) {
      console.error('Error loading attendance:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance history",
        variant: "destructive",
      });
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  const loadGroups = async (memberId) => {
    setIsGroupsLoading(true);
    try {
      const data = await getMemberGroups(memberId);
      setGroups(data);
    } catch (error) {
      console.error('Error loading groups:', error);
      toast({
        title: "Error",
        description: "Failed to load group memberships",
        variant: "destructive",
      });
    } finally {
      setIsGroupsLoading(false);
    }
  };

  const loadFamilyInfo = async (memberId) => {
    setIsFamilyLoading(true);
    try {
      // Get all families and find which one contains this member
      const families = await familyService.getFamilies();
      const memberFamily = families.find(family => 
        family.members.some(member => member.id === memberId)
      );
      setFamilyInfo(memberFamily);
    } catch (error) {
      console.error('Error loading family info:', error);
      toast({
        title: "Error",
        description: "Failed to load family information",
        variant: "destructive",
      });
    } finally {
      setIsFamilyLoading(false);
    }
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const loadPastEvents = async () => {
    setIsEventsLoading(true);
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .lt('start_date', new Date().toISOString())
        .eq('attendance_type', 'check-in')
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Filter out events the member has already attended
      const attendedEventIds = attendance.map(a => a.events.id);
      const availableEvents = events.filter(event => !attendedEventIds.includes(event.id));
      setPastEvents(availableEvents);
    } catch (error) {
      console.error('Error loading past events:', error);
      toast({
        title: "Error",
        description: "Failed to load past events",
        variant: "destructive",
      });
    } finally {
      setIsEventsLoading(false);
    }
  };

  const handleRetroCheckIn = async () => {
    if (!selectedEvent || !member) return;

    try {
      const { error } = await supabase
        .from('event_attendance')
        .insert({
          event_id: selectedEvent.id,
          member_id: member.id,
          status: 'checked-in'
        });

      if (error) throw error;

      // Refresh attendance data
      await loadAttendance(member.id);
      
      // Remove the event from available past events
      setPastEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
      
      // Close dialog and reset selection
      setIsRetroCheckInOpen(false);
      setSelectedEvent(null);

      toast({
        title: "Success",
        description: `Successfully checked in to ${selectedEvent.title}`
      });
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Error",
        description: "Failed to check in to event",
        variant: "destructive",
      });
    }
  };

  const handleEditMember = async (memberData) => {
    try {
      const updatedMember = await updateMember(member.id, {
        firstname: memberData.firstname,
        lastname: memberData.lastname,
        email: memberData.email,
        phone: memberData.phone,
        status: memberData.status,
        image_url: memberData.image_url
      });
      setMember(updatedMember);
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Member updated successfully"
      });
    } catch (error) {
      console.error('Error updating member:', error);
      toast({
        title: "Error",
        description: "Failed to update member",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMember = async () => {
    try {
      await deleteMember(member.id);
      setIsDeleteDialogOpen(false);
      toast({
        title: "Success",
        description: "Member deleted successfully"
      });
      navigate('/members');
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: "Error",
        description: "Failed to delete member",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/members')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Person Profile</h1>
            <p className="text-muted-foreground">
              View and manage person information
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src={member.image_url} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(member.firstname, member.lastname)}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-2xl">{formatName(member.firstname, member.lastname)}</CardTitle>
                <div className="mt-2">
                  <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                    {member.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {member.email && (
                  <div className="flex items-center text-sm">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{formatPhoneNumber(member.phone)}</span>
                  </div>
                )}
                {member.address && (
                  <div className="flex items-center text-sm">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>
                      {[
                        member.address.street,
                        member.address.city,
                        member.address.state,
                        member.address.zip
                      ].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Joined {format(new Date(member.joinDate || member.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="attendance">
            <TabsList>
              <TabsTrigger value="attendance">
                <Church className="h-4 w-4 mr-2" />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="family">
                <Users className="h-4 w-4 mr-2" />
                Family
              </TabsTrigger>
              <TabsTrigger value="groups">
                <Users className="h-4 w-4 mr-2" />
                Groups
              </TabsTrigger>
              <TabsTrigger value="notes">
                <Clock className="h-4 w-4 mr-2" />
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendance">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Attendance History</CardTitle>
                    <CardDescription>
                      View person's attendance records
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      loadPastEvents();
                      setIsRetroCheckInOpen(true);
                    }}
                    variant="outline"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Check In to Past Event
                  </Button>
                </CardHeader>
                <CardContent>
                  {isAttendanceLoading ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Loading attendance history...</p>
                    </div>
                  ) : attendance.length > 0 ? (
                    <div className="space-y-4">
                      {attendance.map((record) => (
                        <Card key={record.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">{record.events.title}</p>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4 mr-2" />
                                  {format(new Date(record.events.start_date), 'MMM d, yyyy • h:mm a')}
                                </div>
                                {record.events.location && (
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    {record.events.location}
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className="ml-2">
                                {record.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No attendance records found.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="family">
              <Card>
                <CardHeader>
                  <CardTitle>Family Information</CardTitle>
                  <CardDescription>
                    {member?.firstname} {member?.lastname}'s family details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isFamilyLoading ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Loading family information...</p>
                    </div>
                  ) : familyInfo ? (
                    <div className="space-y-6">
                      {/* Family Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-semibold">{familyInfo.family_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {familyInfo.members.length} member{familyInfo.members.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => navigate('/members?tab=families')}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          View Family
                        </Button>
                      </div>

                      {/* Family Members */}
                      <div className="space-y-3">
                        <h4 className="text-lg font-medium">Family Members</h4>
                        {familyInfo.members.map((familyMember) => (
                          <Card key={familyMember.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={familyMember.image_url} />
                                    <AvatarFallback className="text-sm">
                                      {getInitials(familyMember.firstname, familyMember.lastname)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">
                                      {familyMember.firstname} {familyMember.lastname}
                                    </div>
                                    <div className="text-sm text-muted-foreground space-x-2">
                                      <span className="capitalize">{familyMember.member_type}</span>
                                      <span>•</span>
                                      <span className="capitalize">{familyMember.relationship_type}</span>
                                      {familyMember.birth_date && (
                                        <>
                                          <span>•</span>
                                          <span>{calculateAge(familyMember.birth_date)} years old</span>
                                        </>
                                      )}
                                    </div>
                                    {(familyMember.email || familyMember.phone) && (
                                      <div className="text-sm text-muted-foreground mt-1">
                                        {familyMember.email && (
                                          <div className="flex items-center gap-1">
                                            <Mail className="w-3 h-3" />
                                            {familyMember.email}
                                          </div>
                                        )}
                                        {familyMember.phone && (
                                          <div className="flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            {familyMember.phone}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {familyMember.is_primary && (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                      <Crown className="w-3 h-3 mr-1" />
                                      Primary
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Not in a family</h3>
                      <p className="text-muted-foreground mb-4">
                        {member?.firstname} {member?.lastname} is not currently assigned to any family.
                      </p>
                      <Button
                        onClick={() => navigate('/members?tab=families')}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Manage Families
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groups">
              <Card>
                <CardHeader>
                  <CardTitle>Groups</CardTitle>
                  <CardDescription>
                    Person's group memberships
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isGroupsLoading ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Loading groups...</p>
                    </div>
                  ) : groups.length > 0 ? (
                    <div className="space-y-4">
                      {groups.map((item) => (
                        <Card key={item.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">{item.group.name}</p>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <User className="h-4 w-4 mr-2" />
                                  {item.group.leader ? 
                                    `${item.group.leader.firstname} ${item.group.leader.lastname}` : 
                                    'No leader assigned'}
                                </div>
                                {item.group.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {item.group.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No group memberships found.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                  <CardDescription>
                    Person's notes and history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Notes functionality coming soon.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Member Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              Update the member's information below.
            </DialogDescription>
          </DialogHeader>
          <MemberForm
            initialData={{
              firstname: member.firstname,
              lastname: member.lastname,
              email: member.email,
              phone: member.phone,
              status: member.status,
              image_url: member.image_url
            }}
            onSave={handleEditMember}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Person</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this person? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteMember}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retroactive Check-in Dialog */}
      <Dialog open={isRetroCheckInOpen} onOpenChange={setIsRetroCheckInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In to Past Event</DialogTitle>
            <DialogDescription>
              Select a past event to check in {member?.firstname} {member?.lastname}
            </DialogDescription>
          </DialogHeader>
          
          {isEventsLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : pastEvents.length > 0 ? (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {pastEvents.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 ${
                    selectedEvent?.id === event.id ? 'border-primary bg-muted/50' : ''
                  }`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{event.title}</p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(new Date(event.start_date), 'MMM d, yyyy • h:mm a')}
                    </div>
                    {event.location && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-2" />
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No past events available for check-in.</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRetroCheckInOpen(false);
                setSelectedEvent(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRetroCheckIn}
              disabled={!selectedEvent}
            >
              Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 