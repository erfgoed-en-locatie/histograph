// find source and target nodes
MATCH (m:_) WHERE m.id IN {idsFrom}
MATCH (n:_) WHERE n.id IN {idsTo}

// find corresponding equivalence classes (ECs)
OPTIONAL MATCH m <-[:`=`]- (mConcept:`=`)
OPTIONAL MATCH n <-[:`=`]- (nConcept:`=`)

// choose the right node (EC if there, otherwise only member)
WITH m,
     coalesce(nConcept, n) AS to,
     coalesce(mConcept, m) AS from

// ensure we have a path
MATCH p = shortestPath(from -[:«relations»|`=`|`=i` * 1 .. 6]-> to)

RETURN DISTINCT m.id AS id
LIMIT 25