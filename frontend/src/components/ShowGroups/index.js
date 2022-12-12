import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { thunkGetAllGroups } from '../../store/groups'
import GroupCard from '../GroupCard';

const ShowGroups = () => {
    const dispatch = useDispatch();
    const groups = useSelector(state => state.groups.allGroups);
   
    const groupsArray = Object.values(groups);
    
    useEffect(() => {
       dispatch(thunkGetAllGroups()); 
    }, [dispatch])
    
    console.log("groups after refresh:", groupsArray) 

    if (!groups) {
        return null;
    }
    
    return (
        <div>
            {groupsArray.map(group => (
                <GroupCard group={group} key={group.id}/>
            ))}
        </div>
    )
}

export default ShowGroups;