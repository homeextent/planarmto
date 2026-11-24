import type {FloorplanState} from '../types';
import {exactEndpoint} from './precisionDrafting';
import {detectRoomFaces,partitionCrossingWalls,computeDeckLedger} from './cadMath';

/** Bounded length edit: keep the start fixed, move only a free end, never repartition other walls silently. */
export function resizeWallSegment(state:FloorplanState,id:string,length:number):FloorplanState{
 const wall=state.walls.find(w=>w.id===id);
 if(!wall)throw Error('Select a wall segment.');
 const a=state.nodes.find(n=>n.id===wall.startNodeId),b=state.nodes.find(n=>n.id===wall.endNodeId);
 if(!a||!b)throw Error('Missing wall endpoint.');
 if(state.walls.some(w=>w.id!==id&&(w.startNodeId===b.id||w.endNodeId===b.id))||state.rooms.some(r=>r.nodeIds.includes(b.id)))throw Error('Connected endpoint: use coordinated geometry editing instead.');
 if(state.apertures.some(ap=>ap.wallId===id&&ap.offset+ap.width>length-1e-7))throw Error('Requested length conflicts with an existing opening.');
 const end=exactEndpoint(a,b,length);
 if(state.nodes.some(n=>n.id!==b.id&&Math.hypot(n.x-end.x,n.y-end.y)<1e-7))throw Error('Requested endpoint coincides with another node.');
 const nodes=state.nodes.map(n=>n.id===b.id?{...n,...end}:n);
 const partitioned=partitionCrossingWalls(nodes,state.walls,state.apertures);
 if(partitioned.nodes.length!==nodes.length||partitioned.walls.length!==state.walls.length||partitioned.apertures.length!==state.apertures.length)throw Error('Requested length intersects existing geometry.');
 const rooms=detectRoomFaces(nodes,state.walls,state.rooms,state.settings.defaultWallHeight);
 if(rooms.length!==state.rooms.length)throw Error('Requested length changes room topology.');
 const map=new Map(nodes.map(n=>[n.id,n]));
 return {...state,nodes,rooms,decks:state.decks.map(d=>({...d,ledgerLengthLf:computeDeckLedger(d.points,state.walls,map)}))};
}
