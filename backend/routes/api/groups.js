const express = require('express');
const { setTokenCookie, restoreUser, requireAuth, isOrganizer, isOrganizerOrCoHost } = require('../../utils/auth');
const { Attendance, Event, EventImage, Group, GroupImage, Membership, User, Venue, sequelize } = require('../../db/models');
const { json } = require('express');
const { Op } = require('sequelize')

const router = express.Router();


// get all members for groupId
// no auth requires, but different response for org/cohost
// DRY IT UP 
router.get('/:groupId/members', async (req, res, next) => {
    const { user } = req;
    const group = await Group.findByPk(req.params.groupId);
    if (!group){
        const err = new Error("Group could not be found");
        err.status = 404;
        return next(err)
    }

    const isOrgOrCohost = await Membership.findOne({
        where: {
            userId: user.id,
            groupId: group.id,
            status: {
                [Op.in]: ['organizer', 'co-host']
            }
        }
    });

    if(isOrgOrCohost){
        const allMembers = await Group.findByPk(req.params.groupId, {
            include: {
                model: User,
                as: "members"
            }
        })
        const jsonMembers = allMembers.toJSON();
        const result = jsonMembers.members
        for (let member of result){
            delete member.username;
            delete member.Membership.userId;
            delete member.Membership.groupId;
            delete member.Membership.createdAt;
            delete member.Membership.updatedAt;
        }
    
        return res.json(
            {
                Members: result
            }
        )
    }

    const allMembers = await Group.findByPk(req.params.groupId, {
        include: {
            model: User,
            as: "members",
        }
    })
    const jsonMembers = allMembers.toJSON();
    const result = jsonMembers.members
    let memberIndex = -1;
    for (let member of result) {
        memberIndex += 1
        if (member.Membership.status === 'pending'){
            result.splice(memberIndex, 1)
        }
        delete member.username;
        delete member.Membership.userId;
        delete member.Membership.groupId;
        delete member.Membership.createdAt;
        delete member.Membership.updatedAt;
    }

    res.json(
        {
            Members: result
        }
    )

    
})


// create event for group based on id
router.post('/:groupId/events', requireAuth, isOrganizerOrCoHost, async(req, res, next) => {
    const { venueId, name, type, capacity, price, description, startDate, endDate } = req.body;
    const { groupId}  = req.params;

    // const newStartDate = new Date(startDate)
    // const strStartDate = new String(newStartDate)
    // const newEndDate = new Date(endDate)
    // const strStartDate = newStartDate.toDateString()
    // console.log(strStartDate);
    

    console.log(groupId, venueId, name, type, capacity, price, description, startDate, endDate)
    const newEvent = await Event.create({
        groupId,
        venueId,
        name,
        type,
        capacity,
        price,
        description,
        startDate,
        endDate
    })

    res.json(newEvent);
})

// get all events for group by groupid
// no auth
// REFACTOR PLEASE
router.get('/:groupId/events', async (req, res, next) => {
    const group = await Group.findByPk(req.params.groupId);
    if(!group){
        const err = new Error('Group could not be found');
        err.status = 404;
        return next(err);
    } 

    const events = await Event.findAll({
        where: {
            groupId: req.params.groupId
        },
        include: [
            {
                model: Venue,
                attributes: ['id', 'city', 'state'],
                required: false,
            },
            {
                model: Group,
                attributes: ['id', 'name', 'city', 'state']
            },
            {
                model: EventImage,
                attributes: ['url'],
                where: {
                    preview: true
                },
                required: false
            }
        ]
    });
    const jsonEvents = [];

    const findNumAttending = async function(eventId){
        return await Attendance.count({
            where: {
                eventId: eventId
            }
        })
       
    }
    
    for (let event of events){
        const jsonEvent = event.toJSON();

        const numAttending = await findNumAttending(jsonEvent.id);
        console.log(numAttending);
        jsonEvent.numAttending = numAttending;

        if(event.EventImages.length){
            jsonEvent.previewImage = event.EventImages[0].url
        } else {
            jsonEvent.previewImage = "No preview image provided"
        }
        delete jsonEvent.EventImages;
        delete jsonEvent.createdAt;
        delete jsonEvent.updatedAt;
        delete jsonEvent.capacity;
        delete jsonEvent.price;
        delete jsonEvent.description;
        

        jsonEvents.push(jsonEvent)
    }
    // console.log(jsonEvents)
    
    res.json({
        Events: jsonEvents
    })
})

// get all venues for group by id
// requires user to be organizer or cohost
router.get('/:groupId/venues', requireAuth, isOrganizerOrCoHost, async (req, res, next) => {
   const groupVenues = await Venue.findAll({
    where: {
        groupId: req.params.groupId
    }
   })
    
    res.json({
        Venues: groupVenues
    });
})

// create a new venue for a group
// user must be organizer or cohost
router.post('/:groupId/venues', requireAuth, isOrganizerOrCoHost, async (req, res, next) => {

    const { address, city, state, lat, lng } = req.body;
    const newVenue = await Venue.create({
        groupId: req.params.groupId,
        address,
        city,
        state,
        lat,
        lng
    })
    // why default scope no work?
    res.json({
        id: newVenue.id,
        groupId: newVenue.groupId,
        address: newVenue.address,
        city: newVenue.city,
        state: newVenue.state,
        lat: newVenue.lat,
        lng: newVenue.lng
    });

})

// post create new image for group
// current user must be organizer for the group
// created new auth middleware to check for organizer
router.post('/:groupId/images', requireAuth, isOrganizer, async (req, res, next) => {
    const { url, preview } = req.body
    const group = await Group.findByPk(req.params.groupId);
    const newGroupImage = await group.createGroupImage({
        url,
        preview
    })

    // figure out why default scope didnt work here
    res.json({
        id: newGroupImage.id,
        url: newGroupImage.url,
        preview: newGroupImage.preview
    })
})

// edit a group
// current user must be organizer for the group
router.put('/:groupId', requireAuth, isOrganizer, async (req, res, next) => {
    const {name, about, type, private, city, state } = req.body;

    const group = await Group.findByPk(req.params.groupId);
    await group.update({
        name,
        about,
        type,
        private,
        city,
        state
    })

    res.json(group);
});

// delete a group
// requires user isOrganizer
router.delete('/:groupId', requireAuth, isOrganizer, async (req, res, next) => {
    const group = await Group.findByPk(req.params.groupId);
    await group.destroy();

    res.json("Successfully deleted");
})


// post create new group
router.post('/', requireAuth, async (req, res, next) => {
    const {user} = req;
    const { name, about, type, private, city, state } = req.body;
    console.log(about)
    console.log(type)

    try {
        const newGroup = await Group.create({
            organizerId: user.id,
            name,
            about,
            type,
            private,
            city,
            state
        })
        const newMembership = await Membership.create({
            userId: user.id,
            groupId: newGroup.id,
            status: "organizer"
        })
        console.log(newMembership);
    
        res.json(newGroup)
    } catch (err) {
        err.status = 400;
        next(err)
    }
})


// Get current users groups
router.get('/current', requireAuth, async (req, res, next) => {
    const { user } = req;
    // find user by userid and include groups
    const userGroups = await User.findByPk(user.id, {
        include: [
        {
            model: Group,
            as: "member",
            include: [
                {
                    model: User,
                    as: "members"
                },
                {
                    model: GroupImage,
                    attributes: ['url'],
                    where: {
                        preview: true,
                    },
                    required: false
                },
            ],
        },
    ]
    });
    const jsonGroups = userGroups.toJSON()
    // grab the list of groups under alias "member"
    const groups = jsonGroups.member;
    // for each group in array,
    // remove unneccessary eles and get num members and previmg url
    groups.forEach(group => {
        delete group.Membership

        group.numMembers = group.members.length
        delete group.members

        if (group.GroupImages.length) {
            group.previewImage = group.GroupImages[0].url
        } else {
            group.previewImage = "No preview image provided"
        }
        delete group.GroupImages

    })
    // console.log(groups)
    // 

    res.json({
        Groups: [
            ...groups
        ]
    })
})



// Get group by group id
router.get(
    '/:groupId',
    async (req, res, next) => {
        let id = req.params.groupId;

        const group = await Group.findByPk(id, {
            include: [
                {
                    model: User,
                    as: "members"
                },
                {
                    model: GroupImage,
                    required: false
                },
                {
                    model: User,
                    as: 'Organizer',
                    attributes: ['id', 'firstName', 'lastName']
                },
                {
                    model: Venue,
                    required: false,
                }
            ],

        });

        if (group) {
            const jsonGroup = group.toJSON()
            jsonGroup.numMembers = group.members.length;
            delete jsonGroup.members;

            res.json({
                jsonGroup
            })
        } else {
            const err = new Error()
            err.status = 404;
            err.message = "Group couldn't be found";
            next(err)
        }
    })

// GET all groups
router.get(
    '/',
    async (req, res, next) => {
        
        const allGroups = await Group.findAll({
            include: [
                {
                    model: User,
                    as: "members"
                },
                {
                model: GroupImage,
                attributes: ['url'],
                where: {
                    preview : true,
                },
                required: false
                },
            ],
            
        });
    
        const groupsArr = [];
        
        // JSON groups
        await allGroups.forEach( async group => {
        
            jsonGroup = group.toJSON();
     
        groupsArr.push(jsonGroup)
        })

        groupsArr.forEach(group => {
            if (group.GroupImages.length) {
                group.previewImage = group.GroupImages[0].url
            } else {
                group.previewImage = "No preview image provided"
            }
            delete group.GroupImages
            
            group.numMembers = group.members.length
            delete group.members
            
        })

        res.json({
            Groups: groupsArr
        })
    }
)





module.exports = router;