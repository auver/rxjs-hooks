import { Observable, BehaviorSubject, Subscription } from 'rxjs'
import { useState, useEffect, useRef } from 'react'
import useConstant from 'use-constant'

import { RestrictArray } from './type'

function areInputsEqual(newInputs: ReadonlyArray<any> | undefined, lastInputs: ReadonlyArray<any> | undefined) {
  if (!newInputs || !lastInputs || newInputs.length !== lastInputs.length) {
    return false
  }

  for (let i = 0; i < newInputs.length; i++) {
    if (newInputs[i] !== lastInputs[i]) {
      return false
    }
  }

  return true
}

export type InputFactory<State> = (state$: Observable<State>) => Observable<State>
export type InputFactoryWithInputs<State, Inputs> = (
  state$: Observable<State>,
  inputs$: Observable<RestrictArray<Inputs>>,
) => Observable<State>

export function useObservable<State>(inputFactory: InputFactory<State>): State | null
export function useObservable<State>(inputFactory: InputFactory<State>, initialState: State): State
export function useObservable<State, Inputs>(
  inputFactory: InputFactoryWithInputs<State, Inputs>,
  initialState: State,
  inputs: RestrictArray<Inputs>,
): State
export function useObservable<State, Inputs extends ReadonlyArray<any>>(
  inputFactory: InputFactoryWithInputs<State, Inputs>,
  initialState?: State,
  inputs?: RestrictArray<Inputs>,
): State | null {
  const state$ = useConstant(() => new BehaviorSubject<State | undefined>(initialState))
  const inputs$ = useConstant(() => new BehaviorSubject<RestrictArray<Inputs> | undefined>(inputs))
  const subscription = useRef<Subscription | undefined>(undefined)
  const commmittedInputs = useRef<RestrictArray<Inputs> | undefined>(undefined)

  if (!areInputsEqual(inputs, commmittedInputs.current)) {
    commmittedInputs.current = inputs
    inputs$.next(inputs)
  }

  const [state, setState] = useState(() => {
    let currentState = typeof initialState !== 'undefined' ? initialState : null
    let output$: BehaviorSubject<State>
    if (inputs) {
      output$ = (inputFactory as (
        state$: Observable<State | undefined>,
        inputs$: Observable<RestrictArray<Inputs> | undefined>,
      ) => Observable<State>)(state$, inputs$) as BehaviorSubject<State>
    } else {
      output$ = ((inputFactory as unknown) as (state$: Observable<State | undefined>) => Observable<State>)(
        state$,
      ) as BehaviorSubject<State>
    }

    subscription.current = output$.subscribe((value) => {
      currentState = value
      state$.next(value)
      if (typeof setState !== 'undefined') {
        setState(value)
      }
    })

    return currentState
  })

  useEffect(() => () => {
    subscription.current?.unsubscribe()
    inputs$.complete()
    state$.complete()
  }, []) // immutable forever

  return state
}
